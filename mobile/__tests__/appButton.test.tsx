import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';

jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: new Proxy({}, { get: () => '#000000' }),
    colorScheme: 'light',
  }),
}));
jest.mock('../src/utils/motion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MaterialIcon');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

import AppButton from '../src/components/AppButton';

// The outermost node carrying the button role is the Pressable itself.
const button = (root: ReactTestRenderer.ReactTestInstance) =>
  root.findAll(node => node.props.accessibilityRole === 'button')[0];

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(element);
  });
  return renderer.root;
}

describe('AppButton', () => {
  it('renders the full label on one line with the Android-safe break strategy', () => {
    const root = render(
      <AppButton label="Έναρξη Διαδρομής" onPress={() => {}} icon="navigation-variant" />,
    );
    const label = root.findByType(Text);
    expect(label.props.children).toBe('Έναρξη Διαδρομής');
    expect(label.props.numberOfLines).toBe(1);
    // AppText default: highQuality breaking hid the last word on Android.
    expect(label.props.textBreakStrategy).toBe('simple');
    // adjustsFontSizeToFit mis-measures on Android and clipped «Διαδρομής».
    expect(label.props.adjustsFontSizeToFit).toBeUndefined();

    // The button grows with scaled fonts rather than clipping at a fixed height.
    const pressStyle = StyleSheet.flatten(button(root).props.style);
    expect(pressStyle.minHeight).toBe(56);
    expect(pressStyle.height).toBeUndefined();
  });

  it('keeps icon-only buttons a 56x56 square without a label', () => {
    const root = render(
      <AppButton label="Favourite" onPress={() => {}} icon="heart" iconOnly variant="secondary" />,
    );
    expect(root.findAllByType(Text)).toHaveLength(0);
    const pressStyle = StyleSheet.flatten(button(root).props.style);
    expect(pressStyle.width).toBe(56);
    expect(pressStyle.height).toBe(56);
    expect(button(root).props.accessibilityLabel).toBe('Favourite');
  });
});
