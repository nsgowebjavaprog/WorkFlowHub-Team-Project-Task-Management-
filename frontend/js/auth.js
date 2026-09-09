/* ============================================================================
   auth.js
   -------
   Wires up the login.html and signup.html forms to the Django JWT endpoints.
   Depends on api.js being loaded first (for `apiRequest` and `Auth`).
   ========================================================================== */

function showMessage(el, text, type = "error") {
  el.textContent = text;
  el.className = `form-msg ${type}`;
}

// --- SIGNUP FORM -----------------------------------------------------------
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();               // stop normal browser form submission (page reload)
    const msg = document.getElementById("form-msg");
    const submitBtn = signupForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account...";

    // Gather form values into a plain JS object matching the DRF serializer fields
    const payload = {
      username: signupForm.username.value.trim(),
      email: signupForm.email.value.trim(),
      password: signupForm.password.value,
      full_name: signupForm.full_name.value.trim(),
      role: signupForm.role.value, // "candidate" or "recruiter"
    };

    try {
      // auth: false -> signup doesn't need a token (chicken-and-egg problem)
      const data = await apiRequest("/auth/signup/", { method: "POST", body: payload, auth: false });
      Auth.setTokens(data.tokens);
      Auth.setUser(data.user);
      showMessage(msg, "Account created! Redirecting...", "success");
      setTimeout(() => (window.location.href = "dashboard.html"), 700);
    } catch (err) {
      showMessage(msg, err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Create account";
    }
  });
}

// --- LOGIN FORM --------------------------------------------------------------
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("form-msg");
    const submitBtn = loginForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";

    const payload = {
      username: loginForm.username.value.trim(),
      password: loginForm.password.value,
    };

    try {
      const data = await apiRequest("/auth/login/", { method: "POST", body: payload, auth: false });
      Auth.setTokens(data.tokens);
      Auth.setUser(data.user);
      showMessage(msg, "Welcome back! Redirecting...", "success");
      setTimeout(() => (window.location.href = "dashboard.html"), 500);
    } catch (err) {
      showMessage(msg, err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Log in";
    }
  });
}

// --- LOGOUT (used by dashboard.html's nav button) ---------------------------
function logout() {
  Auth.clear();
  window.location.href = "login.html";
}
