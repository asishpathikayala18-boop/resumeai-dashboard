const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = __dirname;
const uploadDir = path.join(rootDir, "uploads");
const port = Number(process.env.PORT || 4173);
const maxUploadBytes = 10 * 1024 * 1024;
const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);
const skillGroups = {
  frontend: ["html", "css", "javascript", "typescript", "react", "next.js", "tailwind"],
  backend: ["node", "express", "python", "fastapi", "django", "rest api", "graphql"],
  database: ["sql", "postgresql", "mysql", "mongodb", "redis"],
  devops: ["git", "docker", "kubernetes", "ci/cd", "aws", "render", "vercel"],
  fundamentals: ["data structures", "algorithms", "oop", "system design", "testing"],
};
const prioritySkills = [
  "javascript",
  "react",
  "node",
  "python",
  "sql",
  "git",
  "rest api",
  "docker",
  "aws",
  "system design",
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sanitizeFileName(fileName) {
  return path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function parseHeaderValue(header, key) {
  const match = header.match(new RegExp(`${key}="([^"]+)"`));
  return match ? match[1] : "";
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return null;

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const parts = [];
  let start = buffer.indexOf(boundary);

  while (start !== -1) {
    const next = buffer.indexOf(boundary, start + boundary.length);
    if (next === -1) break;

    let part = buffer.subarray(start + boundary.length, next);
    if (part.subarray(0, 2).toString() === "\r\n") {
      part = part.subarray(2);
    }
    if (part.subarray(part.length - 2).toString() === "\r\n") {
      part = part.subarray(0, part.length - 2);
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd !== -1) {
      const rawHeaders = part.subarray(0, headerEnd).toString("utf8");
      const data = part.subarray(headerEnd + 4);
      parts.push({ rawHeaders, data });
    }

    start = next;
  }

  return parts;
}

function extractReadableText(buffer, fileName) {
  const raw = buffer.toString("utf8");
  const visibleText = raw
    .replace(/[^\x20-\x7E\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `${fileName} ${visibleText}`.toLowerCase();
}

function hasSkill(text, skill) {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return pattern.test(text);
}

function analyzeResume(buffer, fileName) {
  const text = extractReadableText(buffer, fileName);
  const allSkills = Object.values(skillGroups).flat();
  const matchedKeywords = allSkills.filter((skill) => hasSkill(text, skill));
  const missingKeywords = prioritySkills.filter((skill) => !matchedKeywords.includes(skill));
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text);
  const hasPhone = /(\+?\d[\d\s().-]{8,}\d)/.test(text);
  const hasProjects = /project|portfolio|github|internship|experience/i.test(text);
  const hasEducation = /education|degree|bachelor|b\.tech|college|university/i.test(text);
  const hasMetrics = /\b\d+%|\b\d+\+|\b\d{2,}\b/.test(text);

  const structureScore = Math.min(100, 48 + (hasEmail ? 12 : 0) + (hasPhone ? 12 : 0) + (hasEducation ? 14 : 0) + (hasProjects ? 14 : 0));
  const keywordScore = Math.min(100, Math.round((matchedKeywords.length / allSkills.length) * 170));
  const skillScore = Math.min(100, 42 + matchedKeywords.length * 5);
  const impactScore = hasMetrics ? 86 : 62;
  const atsScore = Math.round(structureScore * 0.3 + keywordScore * 0.35 + skillScore * 0.2 + impactScore * 0.15);
  const jdMatchScore = Math.min(95, Math.max(45, keywordScore + (hasProjects ? 8 : 0)));
  const actionVerbScore = hasMetrics ? 15 : 10;

  const suggestions = [];

  if (!hasEmail || !hasPhone) {
    suggestions.push({
      title: "Improve contact section",
      detail: "Add a clear email and phone number near the top so recruiters and ATS systems can identify you quickly.",
    });
  }

  if (missingKeywords.length) {
    suggestions.push({
      title: "Add role-matching keywords",
      detail: `Consider adding truthful mentions of ${missingKeywords.slice(0, 5).join(", ")} in skills or project bullets.`,
    });
  }

  if (!hasMetrics) {
    suggestions.push({
      title: "Quantify project impact",
      detail: "Add numbers such as users, speed improvement, accuracy, cost saved, or time reduced to make achievements stronger.",
    });
  }

  if (!hasProjects) {
    suggestions.push({
      title: "Add project evidence",
      detail: "Include 2-3 strong projects with tools used, problem solved, and measurable result.",
    });
  }

  const fallbackSuggestions = [
    {
      title: "Strengthen professional summary",
      detail: "Mention your target role, strongest technologies, and one standout achievement in 2-3 focused lines.",
    },
    {
      title: "Improve skills organization",
      detail: "Group skills by frontend, backend, database, and tools so recruiters can scan your strengths quickly.",
    },
    {
      title: "Use stronger action verbs",
      detail: "Start bullet points with built, optimized, automated, designed, implemented, or improved.",
    },
  ];

  fallbackSuggestions.forEach((suggestion) => {
    if (suggestions.length < 3 && !suggestions.some((item) => item.title === suggestion.title)) {
      suggestions.push(suggestion);
    }
  });

  return {
    fileName,
    atsScore,
    grade: atsScore >= 85 ? "Excellent Score" : atsScore >= 70 ? "Good Score" : "Needs Improvement",
    summary: `Analysis is based on the uploaded resume file: ${fileName}. Improve missing keywords and measurable achievements to raise the score.`,
    metrics: {
      structure: structureScore,
      keywords: keywordScore,
      readability: hasProjects ? 84 : 72,
      skills: skillScore,
      contactInfo: hasEmail && hasPhone ? 95 : hasEmail || hasPhone ? 72 : 48,
      jdMatch: jdMatchScore,
      actionVerbs: actionVerbScore,
    },
    matchedKeywords: matchedKeywords.slice(0, 12),
    missingKeywords: missingKeywords.slice(0, 10),
    suggestions: suggestions.slice(0, 4),
    extractionNote: "PDF/DOCX text extraction is lightweight in this version. A full parser can improve accuracy later.",
  };
}

function handleUpload(request, response) {
  const contentType = request.headers["content-type"] || "";
  const contentLength = Number(request.headers["content-length"] || 0);

  if (!contentType.includes("multipart/form-data")) {
    sendJson(response, 415, { error: "Upload must use multipart form data." });
    return;
  }

  if (contentLength > maxUploadBytes + 2048) {
    sendJson(response, 413, { error: "File is too large. Maximum size is 10 MB." });
    return;
  }

  const chunks = [];
  let received = 0;

  request.on("data", (chunk) => {
    received += chunk.length;
    if (received > maxUploadBytes + 2048) {
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });

  request.on("end", () => {
    const parts = parseMultipart(Buffer.concat(chunks), contentType);
    const filePart = parts && parts.find((part) => part.rawHeaders.includes('name="resume"'));

    if (!filePart) {
      sendJson(response, 400, { error: "No resume file was received." });
      return;
    }

    const originalName = parseHeaderValue(filePart.rawHeaders, "filename");
    const safeName = sanitizeFileName(originalName);
    const extension = path.extname(safeName).toLowerCase();

    if (!safeName || !allowedExtensions.has(extension)) {
      sendJson(response, 400, { error: "Please upload a PDF, DOC, or DOCX resume." });
      return;
    }

    if (filePart.data.length > maxUploadBytes) {
      sendJson(response, 413, { error: "File is too large. Maximum size is 10 MB." });
      return;
    }

    fs.mkdirSync(uploadDir, { recursive: true });
    const storedName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    fs.writeFileSync(path.join(uploadDir, storedName), filePart.data);

    sendJson(response, 200, {
      message: "Resume uploaded successfully.",
      file: {
        originalName: safeName,
        storedName,
        size: filePart.data.length,
      },
      analysis: analyzeResume(filePart.data, safeName),
    });
  });

  request.on("error", () => {
    sendJson(response, 500, { error: "Upload failed. Please try again." });
  });
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(rootDir, normalizedPath);

  if (!filePath.startsWith(rootDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(rootDir, "index.html"), (fallbackError, fallbackContent) => {
        if (fallbackError) {
          response.writeHead(404);
          response.end("Not found");
          return;
        }

        response.writeHead(200, { "Content-Type": mimeTypes[".html"] });
        response.end(fallbackContent);
      });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, { "Content-Type": mimeTypes[extension] || "application/octet-stream" });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/api/upload") {
    handleUpload(request, response);
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    serveStatic(request, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
});

server.listen(port, () => {
  console.log(`ResumeAI server running on http://127.0.0.1:${port}`);
});
