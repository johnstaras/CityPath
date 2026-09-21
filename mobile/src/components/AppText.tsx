import React from 'react';
import { Text as RNText, TextProps } from 'react-native';

/**
 * Drop-in replacement for React Native's `Text`, used everywhere in the app.
 *
 * On Android the default `textBreakStrategy="highQuality"` breaks lines
 * differently from how React Native measured the text, so the last word of a
 * line that nearly fills its box moved to a second line the box had no room
 * for, and vanished: «Έναρξη Διαδρομής» showed as «Έναρξη», and «Όλες οι
 * στάσεις προσβάσιμες με αμαξίδιο» lost «αμαξίδιο». `simple` breaks the way
 * the text was measured. A caller can still override it. iOS ignores the prop.
 */
const AppText = React.forwardRef<React.ComponentRef<typeof RNText>, TextProps>(
  (props, ref) => <RNText ref={ref} textBreakStrategy="simple" {...props} />,
);

AppText.displayName = 'AppText';

export default AppText;
