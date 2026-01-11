<h4>Token Storage</h4>
<ul>
  <li><strong>Web Apps:</strong> Store in httpOnly cookies (preferred) or localStorage</li>
  <li><strong>Mobile Apps:</strong> Use secure storage (Keychain/Keystore)</li>
  <li><strong>Never:</strong> Store tokens in URL parameters or plain cookies</li>
</ul>

<h4>HTTPS Only</h4>
<p>Always use HTTPS in production. The API only accepts HTTPS connections.</p>

<h4>CORS Configuration</h4>
<p>Configure allowed origins in your customer settings to prevent unauthorized access.</p>

<h4>IP Allowlisting</h4>
<p>For additional security, configure IP allowlists in customer settings.</p>

<h4>Token Refresh</h4>
<p>Implement automatic token refresh before expiration to maintain seamless customer experience.</p>

