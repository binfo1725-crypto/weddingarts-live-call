// OmniSix AI - Unified Gemini Vision Analyzer & Bank Slip Verification Engine
// Powered by Google Gemini Multimodal Vision

const fetchFn = typeof globalThis.fetch === 'function'
  ? globalThis.fetch.bind(globalThis)
  : (...args) => import('node-fetch').then(({ default: f }) => f(...args));

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
2. Regardless of whether it is a bank slip or NOT (e.g., a product photo, earbuds case, clothes, screenshot, error message, design sample, inquiry, QR code, etc.), clearly describe what item/brand/text/details are shown in the image so our Sales AI and human staff immediately understand what the customer sent.

Return strict JSON matching these keys:
{
  "isBankSlip": boolean,
  "bankName": "string or N/A",
  "amount": number,
  "referenceNumber": "string or N/A",
  "date": "string or N/A",
  "confidence": number,
  "summary": "1-sentence concise summary",
  "imageDescription": "Clear factual description of visible product/brand/text/UI in the image",
  "customerIntent": "1-sentence guess of what customer wants"
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
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    }
  };

  const models = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
  for (const model of models) {
    for (const key of keys) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetchFn(url, {
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
