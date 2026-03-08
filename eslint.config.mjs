import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: ["hubspot-project/**"]
  },
  ...nextVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off"
    }
  }
];

export default config;
