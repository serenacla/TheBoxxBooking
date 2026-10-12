// Each release archive pins its own surface. Hosting variables cannot enable
// the other website or accidentally expose the administration interface.
export const deployment: { mode: "booking" | "admin"; version: string } = {
  mode: "booking",
  version: "2.1.0",
};
