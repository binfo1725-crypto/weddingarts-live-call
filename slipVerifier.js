// OmniSix AI - Unified Gemini Vision Analyzer & Bank Slip Verification Engine
// Powered by Google Gemini Multimodal Vision

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

/**
 * Analyze any customer-sent image (bank deposit slip, product photo, screenshot, design sample, etc.)
 * AND determine whether it is a genuine bank transfer slip/receipt.
 *
 * @param {Buffer} imageBuffer - Binary buffer of the received image
 * @param {string} mimeType - e.g. 'image/jpeg', 'image/png'
 * @param {string|string[]} apiKeyOrKeys - Single Gemini API Key or prioritized pool of keys
 * @param {object} options - Optional context { caption, storeName }
 * @returns {Promise<{ isBankSlip: boolean, bankName: string, amount: number, referenceNumber: string, date: string, confidence: number, summary: string, imageDescription: string, customerIntent: string }>}
 */
async function analyzeImageWithGeminiVision(imageBuffer, mimeType = 'image/jpeg', apiKeyOrKeys = '', options = {}) {
  if (!imageBuffer || imageBuffer.length < 50) {
    return {
      isBankSlip: false,
      imageDescription: '',
      customerIntent: '',
      error: 'No image buffer provided'
    };
  }

  const keys = Array.isArray(apiKeyOrKeys)
    ? apiKeyOrKeys.filter(Boolean)
    : (apiKeyOrKeys ? [apiKeyOrKeys] : []);

  if (keys.length === 0) {
    return {
      isBankSlip: false,
      imageDescription: '',
      customerIntent: '',
      error: 'No Gemini API key available'
    };
  }

  const effectiveMime = (mimeType || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
  const base64Data = imageBuffer.toString('base64');
  const caption = options.caption ? String(options.caption).trim() : '';
  const storeName = options.storeName ? String(options.storeName).trim() : 'the business';

  const promptText = `You are the Vision AI for ${storeName} in Sri Lanka.
Analyze this image sent by a WhatsApp customer${caption ? ` with caption "${caption}"` : ''}.

Perform TWO tasks accurately:
1. Check if this image is a genuine bank transfer receipt, deposit slip, ATM/CDM receipt, or online banking/wallet payment proof (BOC, Commercial Bank, Sampath, HNB, People's Bank, Seylan, FriMi, Genie, eZ Cash, LOLC, etc.).
2. Regardless of whether it is a bank slip or NOT (e.g., a product photo, screenshot, error message, design sample, price tag, inquiry, photo of an item, QR code, etc.), clearly describe EVERY important visual detail and visible text in the image so both our Sales AI and our human staff in the Web App Inbox immediately understand what the customer sent.

Return ONLY a strict JSON object with no markdown fences:
{
  "isBankSlip": true or false,
  "bankName": "Bank or payment app name, or 'N/A'",
  "amount": numeric LKR amount (e.g. 4500, or 0 if not a payment slip),
  "referenceNumber": "Transaction reference number if visible, or 'N/A'",
  "date": "Date if visible, or 'N/A'",
  "confidence": 0.0 to 1.0,
  "summary": "Brief 1-sentence summary in English/Sinhala",
  "imageDescription": "Detailed factual visual description of what is shown in the image (visible text, numbers, product type, screenshot contents, UI errors, etc.) in plain clear language",
  "customerIntent": "1-sentence interpretation of what the customer wants by sending this image"
}`;

  const payload = {
    contents: [{
      parts: [
        { text: promptText },
        {
          inlineData: {
            mimeType: effectiveMime,
            data: base64Data
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 650
    }
  };

  const models = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
  for (const model of models) {
    for (const key of keys) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(12000)
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          console.warn(`[vision] ${model} failed (${res.status}):`, data?.error?.message || 'HTTP error');
          continue;
        }

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!rawText) continue;

        let parsed = null;
        try {
          const cleanJson = rawText.replace(/```json\s*|```/g, '').trim();
          const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanJson);
        } catch (_) {
          // If Gemini returned natural prose instead of strict JSON, preserve it as imageDescription
          return {
            isBankSlip: false,
            bankName: 'N/A',
            amount: 0,
            referenceNumber: 'N/A',
            date: new Date().toISOString().split('T')[0],
            confidence: 0.7,
            summary: rawText.slice(0, 140),
            imageDescription: rawText.trim(),
            customerIntent: 'Customer shared an image for assistance.'
          };
        }

        return {
          isBankSlip: !!parsed.isBankSlip,
          bankName: parsed.bankName || 'N/A',
          amount: parseFloat(parsed.amount) || 0,
          referenceNumber: parsed.referenceNumber || 'REF-' + Date.now().toString().slice(-6),
          date: parsed.date || new Date().toISOString().split('T')[0],
          confidence: parsed.confidence || 0.9,
          summary: parsed.summary || parsed.imageDescription || 'Image analyzed',
          imageDescription: parsed.imageDescription || parsed.summary || '',
          customerIntent: parsed.customerIntent || ''
        };
      } catch (e) {
        console.warn(`[vision] ${model} exception:`, e.message);
      }
    }
  }

  return {
    isBankSlip: false,
    imageDescription: '',
    customerIntent: '',
    error: 'Image analysis temporarily unavailable'
  };
}

/**
 * Backward-compatible alias for bank slip verification
 */
async function verifyBankSlipWithGeminiVision(imageBuffer, mimeType = 'image/jpeg', apiKey = '') {
  return await analyzeImageWithGeminiVision(imageBuffer, mimeType, apiKey);
}

module.exports = { verifyBankSlipWithGeminiVision, analyzeImageWithGeminiVision };
