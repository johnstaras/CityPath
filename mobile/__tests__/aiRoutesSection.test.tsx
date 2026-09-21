import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockConfirm = jest.fn();

jest.mock('../src/context/DialogContext', () => ({
  useDialog: () => ({ confirm: mockConfirm, alert: jest.fn(), show: jest.fn(), hide: jest.fn() }),
}));
jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: new Proxy({}, { get: () => '#000000' }),
    colorScheme: 'light',
  }),
}));
// A few real (Greek) strings, so the upper-casing of labels is exercised with
// accented text; every other key comes back as itself.
const mockStrings: Record<string, string> = {
  'accessibility.routeAccessible': 'Προσβάσιμη',
};
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      mockStrings[key] ?? options?.defaultValue ?? key,
  }),
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MaterialIcon');
jest.mock('../src/components/Skeleton', () => ({ RouteCard: () => null }));

import AiRoutesSection from '../src/components/AiRoutesSection';
import { Route } from '../src/models';

function renderSection(onGenerate: jest.Mock, routes: Route[] = []) {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <AiRoutesSection
        routes={routes}
        isLoading={false}
        onSelectRoute={jest.fn()}
        isGenerationEnabled
        isGenerating={false}
        onGenerate={onGenerate}
        canGenerate
      />,
    );
  });
  return renderer!;
}

function pressGenerate(renderer: ReactTestRenderer.ReactTestRenderer) {
  const tile = renderer.root.find(
    node => node.props.accessibilityLabel === 'home.aiRoutes.generate' && typeof node.props.onPress === 'function',
  );
  ReactTestRenderer.act(() => {
    tile.props.onPress();
  });
}

describe('AiRoutesSection live generation', () => {
  beforeEach(() => {
    mockConfirm.mockReset();
  });

  it('asks for confirmation instead of generating on the first tap', () => {
    const onGenerate = jest.fn();
    pressGenerate(renderSection(onGenerate));

    expect(onGenerate).not.toHaveBeenCalled();
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    const options = mockConfirm.mock.calls[0][0];
    expect(options.title).toBe('Create a new route with AI?');
    expect(options.message).toMatch(/AI/);
    expect(options.message).toMatch(/few seconds/);
    expect(options.confirmLabel).toBe('Create route');
  });

  it('generates only after the user confirms', () => {
    const onGenerate = jest.fn();
    pressGenerate(renderSection(onGenerate));

    const { onConfirm } = mockConfirm.mock.calls[0][0];
    ReactTestRenderer.act(() => {
      onConfirm();
    });
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});

function makeRoute(overrides: Partial<Route>): Route {
  return {
    id: 101,
    title: 'Plaka and Anafiotika',
    estimatedDurationMinutes: 60,
    distanceMeters: 2400,
    category: 'historical',
    createdBy: 'ai',
    accessibilityScore: 1,
    ...overrides,
  };
}

function allText(renderer: ReactTestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAll(node => (node.type as unknown) === 'Text')
    .map(node => ([] as unknown[]).concat(node.props.children).join(''));
}

describe('AiRoutesSection labelling', () => {
  it('titles the strip as curated routes, not AI-generated ones', () => {
    const text = allText(renderSection(jest.fn(), [makeRoute({})]));
    expect(text).toContain('home.aiRoutes.title');
    expect(text).toContain('home.aiRoutes.subtitle');
  });

  it('does not mark a curated catalogue route as AI, even though createdBy is "ai"', () => {
    const text = allText(
      renderSection(jest.fn(), [makeRoute({ id: 1 }), makeRoute({ id: 2, isLiveAi: false })]),
    );
    expect(text).not.toContain('home.aiRoutes.badge');
  });

  it('marks a live-generated route as AI', () => {
    const renderer = renderSection(jest.fn(), [makeRoute({ id: 1 }), makeRoute({ id: 2, isLiveAi: true })]);
    expect(allText(renderer).filter(line => line === 'home.aiRoutes.badge')).toHaveLength(1);
    const card = renderer.root.find(
      node => typeof node.props.accessibilityLabel === 'string'
        && node.props.accessibilityLabel.endsWith('home.aiRoutes.badgeA11y')
        && typeof node.props.onPress === 'function',
    );
    expect(card).toBeTruthy();
  });

  it('upper-cases the accessibility badge like the other route cards', () => {
    const text = allText(renderSection(jest.fn(), [makeRoute({})]));
    expect(text).toContain('ΠΡΟΣΒΑΣΙΜΗ · 100%');
    expect(text).not.toContain('Προσβάσιμη · 100%');
  });
});
