# ResumeAI Dashboard

A clean responsive ResumeAI dashboard built with plain HTML, CSS, JavaScript, and a small Node.js upload server.

## Files

- `index.html` - app structure and views
- `styles.css` - responsive UI and animation styles
- `script.js` - page switching and resume upload handling
- `server.js` - static file server and resume upload API
- `package.json` - start script for local and Render hosting
- `render.yaml` - Render web-service deployment config

## Run Locally

Start the server:

```bash
npm start
```

Then open:

```text
http://127.0.0.1:4173
```

## Upload Support

The upload screen accepts:

- PDF
- DOC
- DOCX

Maximum file size: 10 MB.

The server receives validated resume files through:

```text
POST /api/upload
```

Uploaded files are saved in the local `uploads/` folder. This folder is ignored by Git.

After upload, the server returns a lightweight resume analysis with:

- ATS score
- Matched keywords
- Missing keywords
- JD match estimate
- Resume-specific improvement suggestions

The current parser uses built-in Node.js only. A full PDF/DOCX parser or AI model can be added later for deeper real-world accuracy.

## Deploy On Render

1. Push this folder to a GitHub repository.
2. Open Render and choose **New +**.
3. Choose **Blueprint** if you want Render to use `render.yaml`, or choose **Web Service** manually.
4. Connect the GitHub repository.
5. If using Web Service manually, set:
   - Build command: `npm install`
   - Start command: `npm start`
6. Deploy.

The included `render.yaml` is ready for Render Blueprint deployment as a Node web service.
