/* ============================================================================
   dashboard.js
   ------------
   Powers dashboard.html: fetches jobs/resumes from the Django API, lets a
   recruiter post a job (CREATE), lets a candidate upload a resume file
   (CREATE) and trigger the AI match (custom endpoint), and renders results
   (READ).
   ========================================================================== */

// --- Guard: bounce anyone without a valid token back to login ---------------
if (!Auth.isLoggedIn()) {
  window.location.href = "login.html";
}

const user = Auth.getUser();
document.getElementById("welcome-name").textContent = user?.full_name || user?.username || "there";
document.getElementById("role-pill").textContent = user.role;

// Recruiters get a "post a job" form; candidates get a "add resume" form.
if (user.role === "recruiter") {
  document.getElementById("recruiter-panel").style.display = "block";
} else {
  document.getElementById("candidate-panel").style.display = "block";
}

// ----------------------------------------------------------------------------
// JOBS: list (READ) + create (CREATE, recruiter only)
// ----------------------------------------------------------------------------
async function loadJobs() {
  const list = document.getElementById("jobs-list");
  list.innerHTML = "<p class='empty-state'>Loading jobs...</p>";
  try {
    const data = await apiRequest("/jobs/");
    const jobs = data.results || data; // handles paginated or plain list response
    if (!jobs.length) {
      list.innerHTML = "<p class='empty-state'>No jobs posted yet.</p>";
      return;
    }
    list.innerHTML = jobs
      .map(
        (job) => `
        <div class="job-item">
          <div>
            <h4>${escapeHtml(job.title)} - ${escapeHtml(job.company)}</h4>
            <p>${escapeHtml(job.location || "Remote")} · Skills: ${escapeHtml(job.required_skills)}</p>
          </div>
          ${
            user.role === "candidate"
              ? `<button class="btn btn-ghost" onclick="runMatch(${job.id})">Check my match</button>`
              : ""
          }
        </div>`
      )
      .join("");
  } catch (err) {
    list.innerHTML = `<p class='empty-state'>Error loading jobs: ${escapeHtml(err.message)}</p>`;
  }
}

const jobForm = document.getElementById("job-form");
if (jobForm) {
  jobForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      title: jobForm.title.value,
      company: jobForm.company.value,
      description: jobForm.description.value,
      required_skills: jobForm.required_skills.value,
      location: jobForm.location.value,
    };
    try {
      await apiRequest("/jobs/", { method: "POST", body: payload }); // CREATE
      jobForm.reset();
      loadJobs(); // refresh the list -> READ again
    } catch (err) {
      alert("Could not post job: " + err.message);
    }
  });
}

// ----------------------------------------------------------------------------
// RESUMES: list (READ) + create (CREATE, candidate only) via file upload
// ----------------------------------------------------------------------------
let myResumes = [];

async function loadResumes() {
  const select = document.getElementById("resume-select");
  try {
    const data = await apiRequest("/resumes/");
    myResumes = data.results || data;
    select.innerHTML = myResumes
      .map((r) => `<option value="${r.id}">${escapeHtml(r.title)}</option>`)
      .join("");
  } catch (err) {
    console.error(err);
  }
}

const resumeForm = document.getElementById("resume-form");
if (resumeForm) {
  resumeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Basic client-side guard so we don't send an empty file field
    const selectedFile = resumeForm.file.files[0];
    if (!selectedFile) {
      alert("Please choose a PDF or DOCX file first.");
      return;
    }

    // FormData (not JSON) is required to upload a real file -> the browser
    // sets the correct multipart/form-data Content-Type + boundary itself.
    const formData = new FormData();
    formData.append("title", resumeForm.title.value);
    formData.append("file", selectedFile);

    const submitBtn = resumeForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading & extracting text...";

    try {
      await apiRequestForm("/resumes/", formData); // CREATE via multipart
      resumeForm.reset();
      loadResumes();
      alert("Resume uploaded! Text was extracted automatically. Pick a job below and click 'Check my match'.");
    } catch (err) {
      alert("Could not save resume: " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save resume";
    }
  });
}

// ----------------------------------------------------------------------------
// AI MATCH: candidate picks a saved resume, we call Django's custom
// /resumes/{id}/match/{job_id}/ endpoint, which itself calls FastAPI.
// ----------------------------------------------------------------------------
async function runMatch(jobId) {
  const select = document.getElementById("resume-select");
  const resumeId = select.value;
  if (!resumeId) {
    alert("Add a resume first (see the panel above).");
    return;
  }
  const resultsBox = document.getElementById("match-results");
  resultsBox.innerHTML = "<p class='empty-state'>Scoring your resume with AI...</p>";

  try {
    const result = await apiRequest(`/resumes/${resumeId}/match/${jobId}/`, { method: "POST" });
    renderMatchResult(result);
  } catch (err) {
    resultsBox.innerHTML = `<p class='empty-state'>${escapeHtml(err.message)}</p>`;
  }
}

function renderMatchResult(result) {
  const resultsBox = document.getElementById("match-results");
  const scoreClass = result.score >= 70 ? "score-high" : result.score >= 40 ? "score-mid" : "score-low";
  resultsBox.innerHTML = `
    <div class="job-item">
      <div>
        <h4>${escapeHtml(result.job_title)}</h4>
        <p>Matched skills: ${escapeHtml(result.matched_skills) || "none"}</p>
        <p>Missing skills: ${escapeHtml(result.missing_skills) || "none"}</p>
      </div>
      <span class="score-badge ${scoreClass}">${result.score}%</span>
    </div>`;
}

// --- tiny helper to prevent XSS when injecting API text into innerHTML -----
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// --- initial load -------------------------------------------------------
loadJobs();
loadResumes();