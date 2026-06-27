const testLuma = async () => {
  const res = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
    headers: { 'Authorization': `Bearer YOUR_API_KEY_HERE` }
  });
  console.log('Luma Status:', res.status, await res.text());
}
testLuma();
