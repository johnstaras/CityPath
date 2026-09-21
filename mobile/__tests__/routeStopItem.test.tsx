import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import i18n from 'i18next';
import el from '../src/i18n/el.json';

jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: new Proxy({}, { get: () => '#000000' }),
    colorScheme: 'light',
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      require('i18next').t(key, options),
  }),
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MaterialIcon');

import RouteStopItem from '../src/components/RouteStopItem';
import { POI } from '../src/models';

function texts(minutes: number): string[] {
  const poi = { id: 1, name: 'Stoa', lat: 37.97, lng: 23.72, estimatedArrivalMinutes: minutes } as POI;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <RouteStopItem poi={poi} index={2} isLast={false} onPress={jest.fn()} />,
    );
  });
  return renderer!.root
    .findAll(node => (node.type as unknown) === 'Text')
    .map(node => ([] as unknown[]).concat(node.props.children).join(''));
}

describe('RouteStopItem arrival time', () => {
  beforeAll(async () => {
    await i18n.init({
      resources: { el: { translation: el } },
      lng: 'el',
      interpolation: { escapeValue: false },
    });
  });

  it('keeps minutes under an hour', () => {
    expect(texts(45)).toContain('~45 λεπτά');
  });

  it('writes an hour or more like other durations', () => {
    const text = texts(87);
    expect(text).toContain('~1 ώ 27 λεπτά');
    expect(text).not.toContain('~87 λεπτά');
  });
});
