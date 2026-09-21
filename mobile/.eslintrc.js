module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Use src/components/AppText: React Native's Text drops the last word of a
    // nearly-full line on Android (textBreakStrategy="highQuality").
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react-native',
            importNames: ['Text'],
            message: "Import Text from src/components/AppText instead (Android line-break bug).",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['src/components/AppText.tsx', '__tests__/**'],
      rules: { 'no-restricted-imports': 'off' },
    },
  ],
};
