import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scripts de utilidad (Node.js CommonJS)
    "scripts/**/*.js",
    "scripts/**/*.ts",
    ".claude/**/*.js",
    // Tests e2e (Playwright)
    "e2e/**/*.ts",
    // Archivos temporales de migración
    "*.sql",
    "create_rls_policy.js",
    "execute_rls_fix.js",
    "fix_rls_direct.js",
  ]),
  // Reglas personalizadas
  {
    rules: {
      // Convertir errores de 'any' a warnings durante migración
      "@typescript-eslint/no-explicit-any": "warn",
      // Permitir variables no usadas con prefijo _
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }],
      // Patrones de React válidos en efectos
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
