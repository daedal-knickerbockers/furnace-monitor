module.exports = {
    env: {
        es2020: true,
    },
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: "./tsconfig.eslint.json",
        sourceType: "module",
    },
    rules: {
        "max-len": [
            "error",
            {
                code: 120,
                ignorePattern: "^\\s*import",
                ignoreTemplateLiterals: true,
            },
        ],
    },
    plugins: ["@typescript-eslint", "prefer-arrow"],
};
