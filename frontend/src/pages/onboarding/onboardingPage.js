import { onboardingSteps } from "../../data/onboardingData.js";
import { fetchJson } from "../../shared/api.js";
import { isAuthenticated } from "../../shared/authSession.js";
import { appHref } from "../../shared/navigation.js";
import { completeOnboarding } from "../../shared/onboarding.js";
import { renderOnboardingStep } from "../../components/onboarding/OnboardingStep.js";

let currentStep = 0;
let locationSearchTimer = null;
let locationSearchRequest = 0;
let locationState = {
  activeLevel: "city",
  query: "",
  items: [],
  loading: false,
  loadedKey: "",
  selected: {
    value: "Київ",
    label: "Київ",
    level: "city",
  },
  shouldFocus: false,
};

function goToHome() {
  if (locationState.selected?.label) {
    try {
      window.localStorage.setItem(
        "smartcart:selected-location",
        JSON.stringify(locationState.selected),
      );
    } catch {
      // localStorage can be unavailable in private or restricted browser contexts.
    }
  }

  completeOnboarding();
  window.history.pushState({}, "", appHref(isAuthenticated() ? "/" : "/register"));
  window.dispatchEvent(new Event("popstate"));
}

export function renderOnboardingPage() {
  return renderOnboardingStep(onboardingSteps[currentStep], currentStep, onboardingSteps.length, {
    location: locationState,
  });
}

function locationRequestKey() {
  return `${locationState.activeLevel}:${locationState.query.trim()}`;
}

function loadLocationResults({ force = false } = {}) {
  const requestKey = locationRequestKey();
  if (!force && locationState.loadedKey === requestKey) {
    return;
  }

  const requestId = ++locationSearchRequest;
  const params = new URLSearchParams({
    level: locationState.activeLevel,
    limit: "30",
  });
  const query = locationState.query.trim();
  if (query) {
    params.set("q", query);
  }

  locationState = {
    ...locationState,
    loading: true,
    loadedKey: requestKey,
  };

  fetchJson(`/api/business/geography-units?${params.toString()}`)
    .then((data) => {
      if (requestId !== locationSearchRequest) {
        return;
      }

      locationState = {
        ...locationState,
        loading: false,
        items: Array.isArray(data.items) ? data.items : [],
      };
      window.dispatchEvent(new Event("popstate"));
    })
    .catch((error) => {
      if (requestId !== locationSearchRequest) {
        return;
      }

      console.warn(error.message);
      locationState = {
        ...locationState,
        loading: false,
        items: [],
      };
      window.dispatchEvent(new Event("popstate"));
    });
}

function bindLocationSearch() {
  if (onboardingSteps[currentStep]?.type !== "location") {
    return;
  }

  loadLocationResults();

  const input = document.querySelector("#onboardingLocationSearch");
  if (locationState.shouldFocus && input) {
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
    locationState.shouldFocus = false;
  }

  input?.addEventListener("input", (event) => {
    locationState = {
      ...locationState,
      query: event.target.value,
      shouldFocus: true,
    };

    window.clearTimeout(locationSearchTimer);
    locationSearchTimer = window.setTimeout(() => {
      loadLocationResults({ force: true });
    }, 220);
  });

  document.querySelectorAll("[data-onboarding-location-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const nextLevel = tab.dataset.onboardingLocationTab || "city";
      if (nextLevel === locationState.activeLevel) {
        return;
      }

      locationState = {
        ...locationState,
        activeLevel: nextLevel,
        query: "",
        items: [],
        loadedKey: "",
        selected: null,
        shouldFocus: true,
      };
      window.dispatchEvent(new Event("popstate"));
    });
  });

  document.querySelectorAll("[data-onboarding-location-value]").forEach((item) => {
    item.addEventListener("click", () => {
      locationState = {
        ...locationState,
        selected: {
          value: item.dataset.onboardingLocationValue,
          label: item.dataset.onboardingLocationLabel,
          level: item.dataset.onboardingLocationLevel,
          regionCode: item.dataset.onboardingLocationRegion,
          communityCode: item.dataset.onboardingLocationCommunity,
        },
      };
      window.dispatchEvent(new Event("popstate"));
    });
  });
}

export function bindOnboardingPage() {
  document.querySelector("[data-onboarding-back]")?.addEventListener("click", () => {
    currentStep = Math.max(0, currentStep - 1);
    window.dispatchEvent(new Event("popstate"));
  });

  document.querySelector("[data-onboarding-next]")?.addEventListener("click", () => {
    if (currentStep < onboardingSteps.length - 1) {
      currentStep += 1;
      window.dispatchEvent(new Event("popstate"));
      return;
    }

    currentStep = 0;
    goToHome();
  });

  bindLocationSearch();
}
