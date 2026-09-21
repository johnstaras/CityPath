import React from 'react';
import { StatusBar } from 'react-native';
import { useTheme } from '../context/ThemeContext';

function ThemedStatusBar(): React.JSX.Element {
  const { colors, colorScheme } = useTheme();
  return (
    <StatusBar
      barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
      backgroundColor={colors.background}
    />
  );
}

export default ThemedStatusBar;
