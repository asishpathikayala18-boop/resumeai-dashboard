const navButtons = Array.from(document.querySelectorAll("[data-view]"));
const views = Array.from(document.querySelectorAll(".view"));
const sidebar = document.querySelector(".sidebar");
const menuButton = document.querySelector(".menu-button");
const fileInput = document.querySelector("#resume-file");
const chooseFileButton = document.querySelector("#choose-file");
const dropZone = document.querySelector("#drop-zone");
const uploadStatus = document.querySelector("#upload-status");
const uploadResult = document.querySelector("#upload-result");
const uploadResultSummary = document.querySelector("#upload-result-summary");
const uploadResultKeywords = document.querySelector("#upload-result-keywords");

function setView(viewId) {
  const target = document.getElementById(viewId);
  if (!target) return;

  views.forEach((view) => {
    view.classList.toggle("active", view === target);
  });

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewId);
  });

  sidebar.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
  document.title = `${target.querySelector("h1")?.textContent || "ResumeAI"} | ResumeAI`;
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

menuButton.addEventListener("click", () => {
  const isOpen = sidebar.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    sidebar.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
  }
});

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateResumeFile(file) {
  const allowedExtensions = [".pdf", ".doc", ".docx"];
  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = allowedExtensions.some((extension) => lowerName.endsWith(extension));
  const isAllowedSize = file.size <= 10 * 1024 * 1024;

  if (!hasAllowedExtension) {
    return "Please upload a PDF, DOC, or DOCX resume.";
  }

  if (!isAllowedSize) {
    return "File is too large. Maximum size is 10 MB.";
  }

  return "";
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setBar(barSelector, scoreSelector, value) {
  const bar = document.querySelector(barSelector);
  const score = document.querySelector(scoreSelector);
  const normalized = Math.max(0, Math.min(100, Number(value) || 0));
  if (bar) {
    bar.style.width = `${normalized}%`;
    bar.classList.toggle("warn", normalized < 75);
  }
  if (score) score.textContent = normalized;
}

function createChip(text, className) {
  const chip = document.createElement("span");
  chip.className = className;
  chip.textContent = text;
  return chip;
}

function renderResumeAnalysis(analysis) {
  if (!analysis) return;

  const metrics = analysis.metrics || {};
  const matched = analysis.matchedKeywords || [];
  const missing = analysis.missingKeywords || [];
  const suggestions = analysis.suggestions || [];

  document.querySelector(".score-ring")?.style.setProperty("--score", analysis.atsScore);
  setText(".score-ring span", analysis.atsScore);
  setText("#analysis-subtitle", `${analysis.fileName} - analyzed just now`);
  setText("#score-label", analysis.grade);
  setText("#score-summary", analysis.summary);
  setText("#metric-structure", `${metrics.structure || 0}%`);
  setText("#metric-keywords", `${metrics.keywords || 0}%`);
  setText("#metric-readability", `${metrics.readability || 0}%`);
  setText("#metric-skills", `${metrics.skills || 0}%`);
  setText("#metric-contact", `${metrics.contactInfo || 0}%`);
  setText("#keywords-matched", `${matched.length}/${matched.length + missing.length}`);
  setText("#missing-skills-count", missing.length);
  setText("#jd-match-score", `${metrics.jdMatch || 0}%`);
  setText("#action-verbs-score", `${metrics.actionVerbs || 0}/20`);

  setBar("#bar-structure", "#bar-structure-score", metrics.structure);
  setBar("#bar-keywords", "#bar-keywords-score", metrics.keywords);
  setBar("#bar-formatting", "#bar-formatting-score", metrics.readability);
  setBar("#bar-skills", "#bar-skills-score", metrics.skills);
  setBar("#bar-project", "#bar-project-score", metrics.actionVerbs ? metrics.actionVerbs * 5 : 60);
  setBar("#bar-contact", "#bar-contact-score", metrics.contactInfo);

  const keywordChips = document.querySelector("#keyword-chips");
  if (keywordChips) {
    keywordChips.replaceChildren(
      ...missing.map((keyword) => createChip(keyword, "missing")),
      ...matched.map((keyword) => createChip(keyword, "present"))
    );
  }

  const suggestionList = document.querySelector("#suggestion-list");
  if (suggestionList) {
    suggestionList.replaceChildren(
      ...suggestions.map((suggestion) => {
        const article = document.createElement("article");
        const title = document.createElement("b");
        title.textContent = suggestion.title;
        article.append(title, ` ${suggestion.detail}`);
        return article;
      })
    );
  }

  if (uploadResult && uploadResultSummary && uploadResultKeywords) {
    uploadResult.hidden = false;
    uploadResultSummary.textContent = `${analysis.grade}: ${analysis.summary}`;
    uploadResultKeywords.replaceChildren(
      ...matched.slice(0, 6).map((keyword) => createChip(keyword, "present")),
      ...missing.slice(0, 6).map((keyword) => createChip(keyword, "missing"))
    );
  }
}

async function uploadResumeFile(file) {
  if (!file) return;

  const error = validateResumeFile(file);
  uploadStatus.className = "upload-status";

  if (error) {
    uploadStatus.textContent = error;
    uploadStatus.classList.add("error");
    fileInput.value = "";
    return;
  }

  uploadStatus.textContent = `Uploading ${file.name} (${formatFileSize(file.size)})...`;

  const formData = new FormData();
  formData.append("resume", file);

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Upload failed. Please try again.");
    }

    uploadStatus.textContent = `${result.message} ${result.file.originalName} is ready.`;
    uploadStatus.classList.add("success");
    renderResumeAnalysis(result.analysis);
  } catch (uploadError) {
    uploadStatus.textContent = uploadError.message;
    uploadStatus.classList.add("error");
  }
}

window.uploadResumeFile = uploadResumeFile;

chooseFileButton.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  uploadResumeFile(fileInput.files[0]);
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("drag-over");
  uploadResumeFile(event.dataTransfer.files[0]);
});
