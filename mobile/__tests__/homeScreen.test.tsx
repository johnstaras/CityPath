import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

// HomeScreen is exercised with its viewmodels stubbed: the point is how the
// View composes the two independent lists, not the data fetching behind them.
const mockRoutesVm = {
  routes: [] as unknown[],
  isLoading: false,
  isRefreshing: false,
  error: null as Error | null,
  timeFilter: null,
  setTimeFilter: jest.fn(),
  categoryFilter: null,
  setCategoryFilter: jest.fn(),
  searchQuery: '',
  setSearchQuery: jest.fn(),
  userLocation: { lat: 37.97, lng: 23.73 },
  refetch: jest.fn(),
  refresh: jest.fn(),
};
const mockAiVm = {
  routes: [] as unknown[],
  isLoading: false,
  isGenerationEnabled: false,
  generate: jest.fn(),
  isGenerating: false,
  refetch: jest.fn(),
};

jest.mock('../src/viewmodels/useRoutesViewModel', () => ({
  useRoutesViewModel: () => mockRoutesVm,
}));
jest.mock('../src/viewmodels/useAiRoutesViewModel', () => ({
  useAiRoutesViewModel: () => mockAiVm,
}));
jest.mock('../src/viewmodels/useHomeFavoritesViewModel', () => ({
  useHomeFavoritesViewModel: () => ({
    favoriteIds: new Set<number>(),
    pendingIds: new Set<number>(),
    toggleFavorite: jest.fn(),
    isToggling: false,
  }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: new Proxy({}, { get: () => '#000000' }),
    colorScheme: 'light',
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../src/utils/motion', () => ({ useReducedMotion: () => true }));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MaterialIcon');
jest.mock('../src/components/FilterBar', () => () => null);
jest.mock('../src/components/Skeleton', () => ({ RouteCard: () => null }));
jest.mock('../src/components/RouteCard', () => () => null);
jest.mock('../src/components/AiRoutesSection', () => {
  const { Text } = require('react-native');
  return () => <Text>curated-strip</Text>;
});
jest.mock('../src/components/EmptyState', () => {
  const { Text } = require('react-native');
  return ({ title }: { title: string }) => <Text>{title}</Text>;
});

import HomeScreen from '../src/views/home/HomeScreen';

function renderedText(): string[] {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<HomeScreen />);
  });
  return renderer!.root
    .findAll(node => (node.type as unknown) === 'Text')
    .map(node => ([] as unknown[]).concat(node.props.children).join(''));
}

describe('HomeScreen list independence (UC-04)', () => {
  beforeEach(() => {
    mockRoutesVm.error = null;
    mockRoutesVm.routes = [];
    mockAiVm.routes = [];
  });

  it('keeps the curated strip on screen when the main route list fails', () => {
    mockRoutesVm.error = new Error('Network Error');
    const text = renderedText();
    expect(text).toContain('home.errorTitle');
    expect(text).toContain('curated-strip');
  });

  it('shows the main list empty state, not the error, when only the list is empty', () => {
    const text = renderedText();
    expect(text).toContain('home.noRoutes');
    expect(text).not.toContain('home.errorTitle');
    expect(text).toContain('curated-strip');
  });
});
