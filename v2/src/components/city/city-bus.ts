// Tiny shared state between the page content (HTML) and the 3D city. Pages
// publish a "cue" ("crm", "case-3", ...) when a section scrolls into focus and
// the camera rig reads it every frame. No re-renders involved.
export const cityBus = {
  cue: "",
  set(cue: string) {
    this.cue = cue;
  },
  clear(cue: string) {
    if (this.cue === cue) this.cue = "";
  },
};
