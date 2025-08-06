const apiUrl = 'https://your-node-api.onrender.com';

document.getElementById('source-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const source = document.getElementById('source').value;
  const topic = document.getElementById('topic').value;

  const response = await fetch(`${apiUrl}/get-sentence?source=${source}&topic=${topic}`);
  const data = await response.json();

  document.getElementById('sentence-display').innerHTML = `
    <h4>中：${data.zh}</h4>
    <h4>英：${data.en}</h4>
  `;
  document.getElementById('template-display').innerHTML = `<strong>句型模板：</strong> ${data.template}`;
  document.getElementById('parsed-display').innerHTML = `
    <strong>句子分析：</strong> ${JSON.stringify(data.parsed, null, 2)}
  `;
  document.getElementById('similar-display').innerHTML = `
    <strong>相似句：</strong><ul>
    ${data.similar.map(s => `<li>${s.en}</li>`).join('')}
    </ul>
  `;
});
