const testGemini = async () => {
  const GEMINI_API_KEY = "YOUR_API_KEY_HERE";
  const veoPrompt = `Create a 10-second cinematic product ad. Prompt: a red sports car.`;
  
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:generateVideos?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: veoPrompt }],
      parameters: { aspectRatio: "16:9" }
    })
  });
  
  console.log('Veo Status:', res.status, await res.text());

  // Also test gemini-1.5-flash
  const res2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Hello!` }] }]
    })
  });
  console.log('Flash Status:', res2.status);
}
testGemini();
