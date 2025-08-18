import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(bodyParser.json());

const GITHUB_API = "https://api.github.com";
const headers = {
  "Authorization": `token ${process.env.GITHUB_TOKEN}`,
  "Accept": "application/vnd.github.v3+json"
};

// 儲存檔案
app.post("/save", async (req, res) => {
  const { filename, content } = req.body;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  // 檢查檔案是否存在
  const url = `${GITHUB_API}/repos/${repo}/contents/${filename}`;
  let sha = null;
  let method = "PUT";

  try {
    const resp = await fetch(url, { headers });
    if (resp.ok) {
      const json = await resp.json();
      sha = json.sha;
    }
  } catch (e) {}

  // 上傳或更新
  const resp = await fetch(url, {
    method,
    headers,
    body: JSON.stringify({
      message: `save ${filename}`,
      content: Buffer.from(content).toString("base64"),
      branch,
      sha
    })
  });

  const json = await resp.json();
  res.json(json);
});

// 載入檔案
app.get("/load", async (req, res) => {
  const filename = req.query.filename;
  const repo = process.env.GITHUB_REPO;

  const url = `${GITHUB_API}/repos/${repo}/contents/${filename}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) return res.status(404).send("File not found");
  const json = await resp.json();
  const content = Buffer.from(json.content, "base64").toString("utf-8");
  res.send(content);
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));