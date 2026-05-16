const onboardingCompleteKey = "smartcart:onboarding-complete";

export function hasCompletedOnboarding() {
  try {
    return window.localStorage.getItem(onboardingCompleteKey) === "true";
  } catch {
    return false;
  }
}

export function completeOnboarding() {
  try {
    window.localStorage.setItem(onboardingCompleteKey, "true");
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

export function resetOnboarding() {
  try {
    window.localStorage.removeItem(onboardingCompleteKey);
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}
