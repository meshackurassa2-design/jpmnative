const AZAMPAY_AUTH_URL = 'https://authenticator-sandbox.azampay.co.tz/AppRegistration/GenerateToken';
const AZAMPAY_CHECKOUT_URL = 'https://corsproxy.io/?' + encodeURIComponent('https://sandbox.azampay.co.tz/azampay/mno/checkout');
const clientId = '791ee780-6f75-4bb8-98fa-cadfee1bd288';
const clientSecret = 'aMw7kXzPXCoJRogcXrq/KPB96vDH9Ay+ERR0rNYurOMUz1DDpZQ6WAzxXQ4lf3RZNTxwX7CbJ4nB+90x+UOgvuP/u+i48qHBuiAiN5Gxg0YB2ftRZ+bMhUmZ/guQYswFLU2jgHgPsNY1FSNnbyiNl2kxtUGXAdMx3ktpc/TWJhnq/1tKPEsx8UW6NK1yP+SBKoYHBD/cjAYehQnr9PYDWAdNdIJ0B3fjLJsIzqWpvCTX14fdowOkfshVvCRNYG6VN1tHOpRW4mN3PjwwrbmbrR4Z15dsXdHRenI742+m0uN9A0dNXHy1AeCpUJEfbTIw/KZy7h+asFyyPJTTFJ/Y7qQzMEyl1QVvsmq2XzxsCGE4aTyHNnc6rywTemYUaDapfmmQ8OHq7GSL0gwbWVUbL5awq8wnNqZska0tipEVDlTHva9LqETOMIjkh0P4pqed9V9T0EQAJ4U3cYI5Tm4x/GUk5N10KU860UjRjM9CPsCUpFHMYpFwFnsaHDthAfx21DWkmruPTuYYPmTSWKVo8aOhY9j6IjSf3ydxZB9MJZxOamv2eFKCad9ALteAqPOfHHiUURfvgnIOh8PyMYOUP9gNVcGuDBTwQ1SswDniPzFXsPBzHsGjZFNK0ns9huA/EYi+L+LATvK8iNcjlPdp+9sIkB+7KRTTdodv/g4HfM4=';
const apiKey = '9d724c33-d1ef-4253-a258-86550db88b50';

async function testCheckout() {
  try {
    const res = await fetch(AZAMPAY_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appName: 'jpm', clientId, clientSecret })
    });
    const data = await res.json();
    const token = data?.data?.accessToken;

    const checkoutRes = await fetch(AZAMPAY_CHECKOUT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        accountNumber: '0697597246',
        amount: '50',
        currency: 'TZS',
        externalId: 'test-' + Date.now(),
        provider: 'Airtel',
      }),
    });
    console.log(`Status: ${checkoutRes.status}`);
    const checkData = await checkoutRes.text();
    console.log(`Result: ${checkData}`);
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}
testCheckout();
