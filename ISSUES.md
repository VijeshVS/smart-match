# ISSUES

Tracked bugs and known issues for the talent.ai platform.

---

## 🐛 Bug Reports

### [BUG-001] Candidate Portal — Profile save triggered prematurely when entering Education section

**Portal:** Candidate Portal  
**Section:** Profile Setup / Onboarding  
**Status:** Open  

#### Description

When filling out the profile, navigating into the **Education** section triggers an automatic profile save that includes the **Experience** section — even though the company details in Experience have not yet been entered. This results in a `400 Bad Request` from the API due to incomplete/invalid experience data being submitted.

#### Steps to Reproduce

1. Open the Candidate Portal and begin filling out the profile.
2. Fill in some details in the **Experience** section (without completing company details).
3. Navigate to the **Education** section.
4. Observe: a save request fires automatically, bundling the incomplete Experience data.
5. API responds with `400 Bad Request`.

#### Expected Behaviour

The profile should only be saved when:
- The user explicitly clicks a **Save** / **Next** button, OR
- The section being saved has been fully and validly completed.

Navigating between sections should **not** trigger a premature save of incomplete data from other sections.

#### Actual Behaviour

Entering the Education section fires a save that includes incomplete Experience data → API returns `400`.

#### Impact

- Users cannot proceed through profile setup without hitting an error.
- Partial/invalid data may be persisted or attempted to be persisted in the backend.
