import React, { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import AuthScreen from './AuthScreen';
import { supabase } from './lib/supabase';
import * as Updates from 'expo-updates';
import { SymbolView } from 'expo-symbols';
import * as Location from 'expo-location';
import MapView, { Marker, Region } from 'react-native-maps';
import {
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

type TradeCategory =
  | 'Plumber'
  | 'Electrician'
  | 'Builder'
  | 'Heating'
  | 'Locksmith'
  | 'Carpenter'
  | 'Roofer';

type Trade = {
  id: string;
  name: string;
  role: TradeCategory;
  secondaryRole?: string;
  distance: number;
  eta: number;
  rating: number;
  reviews: number;
  image: string;
  accent: string;
  callout: number;
  available: boolean;
  verified: boolean;
  insured: boolean;
  gasSafe?: boolean;
  response: number;
  years: number;
  phone: string;
  about: string;
  services: string[];
};

type CustomerScreen =
  | 'home'
  | 'map'
  | 'profile'
  | 'urgent'
  | 'booking'
  | 'requests'
  | 'messages'
  | 'customerProfile';

type TradeScreen = 'tradeHome' | 'tradeJobs' | 'tradeMap' | 'tradeMessages' | 'tradeProfile';
type Mode = 'customer' | 'tradesperson';

type RequestItem = {
  id: string;
  trade: string;
  issue: string;
  urgency: string;
  status: string;
};

const C = {
  navy: '#071B31',
  navy2: '#0B2A49',
  navy3: '#102F50',
  blue: '#0A7AFF',
  cyan: '#29C0FF',
  green: '#10B981',
  greenSoft: '#DCFCE7',
  text: '#0D1726',
  muted: '#6D7888',
  line: '#E5EAF0',
  pale: '#F4F7FB',
  white: '#FFFFFF',
  gold: '#F5B301',
  orange: '#F97316',
  red: '#EF4444',
};

const trades: Trade[] = [
  {
    id: 'james',
    name: 'James Carter',
    role: 'Plumber',
    secondaryRole: 'Heating Engineer',
    distance: 0.4,
    eta: 7,
    rating: 4.9,
    reviews: 124,
    image: 'https://i.pravatar.cc/600?img=12',
    accent: '#0A7AFF',
    callout: 50,
    available: true,
    verified: true,
    insured: true,
    gasSafe: true,
    response: 5,
    years: 10,
    phone: '07123456789',
    about:
      'Experienced plumber with over 10 years in the trade. I cover everything from leaks and blockages to full bathroom installations. Reliable, clean and professional service.',
    services: ['Leaks & repairs', 'Bathrooms', 'Radiators', 'Installations'],
  },
  {
    id: 'sarah',
    name: 'Sarah Mitchell',
    role: 'Electrician',
    distance: 1.1,
    eta: 10,
    rating: 4.8,
    reviews: 96,
    image: 'https://i.pravatar.cc/600?img=47',
    accent: '#10B981',
    callout: 65,
    available: true,
    verified: true,
    insured: true,
    response: 7,
    years: 8,
    phone: '07123456780',
    about: 'Domestic electrician covering faults, sockets, lighting, upgrades and urgent call-outs.',
    services: ['Fault finding', 'Sockets', 'Lighting', 'Rewires'],
  },
  {
    id: 'daniel',
    name: 'Daniel Brooks',
    role: 'Builder',
    distance: 1.3,
    eta: 12,
    rating: 4.7,
    reviews: 88,
    image: 'https://i.pravatar.cc/600?img=11',
    accent: '#16A085',
    callout: 60,
    available: true,
    verified: true,
    insured: true,
    response: 10,
    years: 12,
    phone: '07123456781',
    about: 'General builder for repairs, brickwork, small extensions and property maintenance.',
    services: ['Brickwork', 'Repairs', 'Extensions', 'Maintenance'],
  },
  {
    id: 'marcus',
    name: 'Marcus Green',
    role: 'Heating',
    distance: 2.1,
    eta: 15,
    rating: 4.9,
    reviews: 102,
    image: 'https://i.pravatar.cc/600?img=68',
    accent: '#F97316',
    callout: 70,
    available: true,
    verified: true,
    insured: true,
    gasSafe: true,
    response: 8,
    years: 14,
    phone: '07123456782',
    about: 'Heating engineer specialising in boilers, radiators and heating faults.',
    services: ['Boilers', 'Radiators', 'Heating faults', 'Servicing'],
  },
  {
    id: 'liam',
    name: 'Liam Jones',
    role: 'Locksmith',
    distance: 1.8,
    eta: 14,
    rating: 4.8,
    reviews: 74,
    image: 'https://i.pravatar.cc/600?img=5',
    accent: '#7C3AED',
    callout: 55,
    available: true,
    verified: true,
    insured: true,
    response: 6,
    years: 7,
    phone: '07123456783',
    about: 'Local locksmith for lockouts, replacements, upgrades and emergency access.',
    services: ['Lockouts', 'Lock changes', 'UPVC locks', 'Security upgrades'],
  },
];

type AppSymbol = {
  ios: string;
  android: string;
};

const categories: { icon: AppSymbol; label: TradeCategory | 'More' }[] = [
  { icon: { ios: 'wrench.and.screwdriver.fill', android: 'plumbing' }, label: 'Plumber' },
  { icon: { ios: 'bolt.fill', android: 'electrical_services' }, label: 'Electrician' },
  { icon: { ios: 'hammer.fill', android: 'construction' }, label: 'Builder' },
  { icon: { ios: 'flame.fill', android: 'local_fire_department' }, label: 'Heating' },
  { icon: { ios: 'lock.fill', android: 'lock' }, label: 'Locksmith' },
  { icon: { ios: 'wrench.adjustable.fill', android: 'carpenter' }, label: 'Carpenter' },
  { icon: { ios: 'house.fill', android: 'roofing' }, label: 'Roofer' },
  { icon: { ios: 'ellipsis', android: 'more_horiz' }, label: 'More' },
];

function AppIcon({
  icon,
  size = 22,
  color = C.text,
}: {
  icon: AppSymbol;
  size?: number;
  color?: string;
}) {
  return (
    <SymbolView
      name={{ ios: icon.ios, android: icon.android, web: icon.android } as any}
      tintColor={color}
      size={size}
    />
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accountType, setAccountType] = useState<'customer' | 'tradesperson'>('customer');

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);

      if (data.session?.user.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_type')
          .eq('id', data.session.user.id)
          .single();

        if (profile?.account_type === 'tradesperson') {
          setAccountType('tradesperson');
          setMode('tradesperson');
        } else {
          setAccountType('customer');
          setMode('customer');
        }
      }

      setAuthLoading(false);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);

      if (nextSession?.user.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_type')
          .eq('id', nextSession.user.id)
          .single();

        if (profile?.account_type === 'tradesperson') {
          setAccountType('tradesperson');
          setMode('tradesperson');
        } else {
          setAccountType('customer');
          setMode('customer');
        }
      }

      setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const applyLatestUpdate = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // expo-updates is unavailable in Expo Go/development mode.
      }
    };

    applyLatestUpdate();
  }, []);

  const [mode, setMode] = useState<Mode>('customer');
  const [customerScreen, setCustomerScreen] = useState<CustomerScreen>('home');
  const [tradeScreen, setTradeScreen] = useState<TradeScreen>('tradeHome');
  const [selectedTrade, setSelectedTrade] = useState<Trade>(trades[0]);
  const [selectedCategory, setSelectedCategory] = useState<TradeCategory | 'All'>('All');
  const [requests, setRequests] = useState<RequestItem[]>([]);

  const openTrade = (trade: Trade) => {
    setSelectedTrade(trade);
    setCustomerScreen('profile');
  };

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: C.white, fontSize: 18, fontWeight: '800' }}>Loading TradeHub…</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (mode === 'tradesperson') {
    const tradeProps = {
      screen: tradeScreen,
      navigate: setTradeScreen,
      switchToCustomer: () => {
        setMode('customer');
        setCustomerScreen('home');
      },
    };

    if (tradeScreen === 'tradeJobs') return <TradeJobsScreen {...tradeProps} />;
    if (tradeScreen === 'tradeMap') return <TradeMapScreen {...tradeProps} />;
    if (tradeScreen === 'tradeMessages') return <TradeMessagesScreen {...tradeProps} />;
    if (tradeScreen === 'tradeProfile') return <TradeSettingsScreen {...tradeProps} signOut={() => supabase.auth.signOut()} />;
    return <TradeHomeScreen {...tradeProps} />;
  }

  if (customerScreen === 'map') {
    return (
      <MapScreen
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        openTrade={openTrade}
        navigate={setCustomerScreen}
      />
    );
  }

  if (customerScreen === 'profile') {
    return (
      <TradeProfileScreen
        trade={selectedTrade}
        back={() => setCustomerScreen('home')}
        message={() => setCustomerScreen('messages')}
        book={() => setCustomerScreen('booking')}
      />
    );
  }

  if (customerScreen === 'urgent') {
    return (
      <UrgentScreen
        back={() => setCustomerScreen('home')}
        openTrade={openTrade}
        addRequest={request => setRequests(prev => [request, ...prev])}
      />
    );
  }

  if (customerScreen === 'booking') {
    return (
      <BookingScreen
        trade={selectedTrade}
        back={() => setCustomerScreen('profile')}
        complete={() => {
          setRequests(prev => [
            {
              id: String(Date.now()),
              trade: selectedTrade.role,
              issue: 'Booking with ' + selectedTrade.name,
              urgency: 'Scheduled',
              status: 'Booked',
            },
            ...prev,
          ]);
          setCustomerScreen('requests');
        }}
      />
    );
  }

  if (customerScreen === 'requests') {
    return <RequestsScreen requests={requests} navigate={setCustomerScreen} />;
  }

  if (customerScreen === 'messages') {
    return <MessagesScreen trade={selectedTrade} navigate={setCustomerScreen} />;
  }

  if (customerScreen === 'customerProfile') {
    return (
      <CustomerProfileScreen
        navigate={setCustomerScreen}
        switchToTrade={() => {
          setMode('tradesperson');
          setTradeScreen('tradeHome');
        }}
        signOut={() => supabase.auth.signOut()}
      />
    );
  }

  return (
    <HomeScreen
      selectedCategory={selectedCategory}
      setSelectedCategory={setSelectedCategory}
      openTrade={openTrade}
      navigate={setCustomerScreen}
    />
  );
}

function CustomerShell({
  children,
  current,
  navigate,
  dark = false,
}: {
  children: React.ReactNode;
  current?: CustomerScreen;
  navigate?: (screen: CustomerScreen) => void;
  dark?: boolean;
}) {
  return (
    <SafeAreaView style={[styles.safe, dark && { backgroundColor: C.navy }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={[styles.screen, dark && { backgroundColor: C.navy }]}>{children}</View>
      {current && navigate ? <CustomerNav current={current} navigate={navigate} /> : null}
    </SafeAreaView>
  );
}

function CustomerNav({
  current,
  navigate,
}: {
  current: CustomerScreen;
  navigate: (screen: CustomerScreen) => void;
}) {
  const items: { icon: AppSymbol; activeIcon: AppSymbol; label: string; route: CustomerScreen }[] = [
    {
      icon: { ios: 'house', android: 'home' },
      activeIcon: { ios: 'house.fill', android: 'home' },
      label: 'Home',
      route: 'home',
    },
    {
      icon: { ios: 'map', android: 'map' },
      activeIcon: { ios: 'map.fill', android: 'map' },
      label: 'Map',
      route: 'map',
    },
    {
      icon: { ios: 'clock', android: 'history' },
      activeIcon: { ios: 'clock.fill', android: 'history' },
      label: 'Requests',
      route: 'requests',
    },
    {
      icon: { ios: 'message', android: 'chat_bubble' },
      activeIcon: { ios: 'message.fill', android: 'chat_bubble' },
      label: 'Messages',
      route: 'messages',
    },
    {
      icon: { ios: 'person', android: 'person' },
      activeIcon: { ios: 'person.fill', android: 'person' },
      label: 'Profile',
      route: 'customerProfile',
    },
  ];

  return (
    <View style={styles.nav}>
      {items.map(item => {
        const active = current === item.route || (current === 'profile' && item.route === 'map');
        return (
          <Pressable
            key={item.route}
            style={styles.navItem}
            onPress={() => navigate(item.route)}
          >
            <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
              <AppIcon
                icon={active ? item.activeIcon : item.icon}
                size={22}
                color={active ? C.blue : '#7C8795'}
              />
            </View>
            <Text style={[styles.navLabel, active && styles.navActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function HomeScreen({
  selectedCategory,
  setSelectedCategory,
  openTrade,
  navigate,
}: {
  selectedCategory: TradeCategory | 'All';
  setSelectedCategory: (category: TradeCategory | 'All') => void;
  openTrade: (trade: Trade) => void;
  navigate: (screen: CustomerScreen) => void;
}) {
  const visible = selectedCategory === 'All' ? trades : trades.filter(t => t.role === selectedCategory);

  return (
    <CustomerShell current="home" navigate={navigate} dark>
      <ScrollView contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View style={styles.logoBubble}>
            <AppIcon icon={{ ios: 'hammer.fill', android: 'construction' }} size={23} color={C.white} />
          </View>
          <Text style={styles.brandWhite}>Trade<Text style={{ color: C.blue }}>Hub</Text></Text>
          <Pressable style={styles.settingsBubble} onPress={() => navigate('customerProfile')}>
            <AppIcon icon={{ ios: 'gearshape.fill', android: 'settings' }} size={23} color={C.white} />
          </Pressable>
        </View>

        <View style={styles.heroBlock}>
          <Text style={styles.hero}>Find trusted</Text>
          <Text style={styles.hero}>tradespeople</Text>
          <Text style={[styles.hero, styles.heroAccent]}>near you.</Text>
        </View>
        <Text style={styles.heroSub}>Trusted local professionals, ready when you need them.</Text>

        <Pressable style={styles.searchBox} onPress={() => navigate('map')}>
          <AppIcon icon={{ ios: 'magnifyingglass', android: 'search' }} size={20} color={C.text} />
          <Text style={styles.searchPlaceholder}>What trade do you need?</Text>
          <View style={styles.searchButton}>
            <AppIcon icon={{ ios: 'magnifyingglass', android: 'search' }} size={19} color={C.white} />
          </View>
        </Pressable>

        <View style={styles.categoryPanel}>
          {categories.map(item => (
            <Pressable
              key={item.label}
              style={[
                styles.categoryTile,
                selectedCategory === item.label && item.label !== 'More' && styles.categoryTileSelected,
              ]}
              onPress={() => {
                if (item.label === 'More') return;
                setSelectedCategory(selectedCategory === item.label ? 'All' : item.label);
              }}
            >
              <View style={styles.categoryIconWrap}>
                <AppIcon icon={item.icon} size={25} color={selectedCategory === item.label ? C.blue : C.navy2} />
              </View>
              <Text style={styles.categoryLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.urgentBanner} onPress={() => navigate('urgent')}>
          <View style={styles.urgentCircle}>
            <AppIcon icon={{ ios: 'bolt.fill', android: 'bolt' }} size={28} color={C.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.urgentTitle}>Need someone now?</Text>
            <Text style={styles.urgentSub}>Get available tradespeople nearby for urgent jobs.</Text>
          </View>
          <View style={styles.urgentArrow}>
            <AppIcon icon={{ ios: 'arrow.right', android: 'arrow_forward' }} size={21} color={C.white} />
          </View>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.darkSectionTitle}>Live near you</Text>
          <Pressable onPress={() => navigate('map')}><Text style={styles.seeAll}>View all</Text></Pressable>
        </View>

        <MapMock trades={visible.length ? visible : trades} onTrade={openTrade} compact />

        <Text style={[styles.darkSectionTitle, { marginTop: 20, marginBottom: 10 }]}>Nearest to you</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {visible.map(trade => (
            <Pressable key={trade.id} style={styles.miniTradeCard} onPress={() => openTrade(trade)}>
              <Image source={{ uri: trade.image }} style={styles.miniImage} />
              <Text style={styles.miniName}>{trade.name}</Text>
              <Text style={styles.miniRole}>{trade.role}</Text>
              <Text style={styles.miniRating}>⭐ {trade.rating} <Text style={styles.miniReviews}>({trade.reviews})</Text></Text>
              <View style={styles.availablePill}><Text style={styles.availableText}>● Available now</Text></View>
              <Text style={styles.miniDistance}>{trade.distance} mi</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ height: 95 }} />
      </ScrollView>
    </CustomerShell>
  );
}

function MapScreen({
  selectedCategory,
  setSelectedCategory,
  openTrade,
  navigate,
}: {
  selectedCategory: TradeCategory | 'All';
  setSelectedCategory: (category: TradeCategory | 'All') => void;
  openTrade: (trade: Trade) => void;
  navigate: (screen: CustomerScreen) => void;
}) {
  const [listMode, setListMode] = useState(false);
  const filtered = selectedCategory === 'All' ? trades : trades.filter(t => t.role === selectedCategory);

  return (
    <CustomerShell current="map" navigate={navigate}>
      <View style={styles.mapTop}>
        <View style={styles.mapSearchRow}>
          <View style={styles.mapSearch}>
            <Text style={{ color: C.muted }}>⌕</Text>
            <Text style={styles.mapSearchText}>Search this area</Text>
          </View>
          <Pressable style={styles.filterSquare} onPress={() => setListMode(v => !v)}>
            <Text style={styles.filterIcon}>{listMode ? '⌖' : '☷'}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="All trades" active={selectedCategory === 'All'} onPress={() => setSelectedCategory('All')} />
          <Chip label="Plumber" active={selectedCategory === 'Plumber'} onPress={() => setSelectedCategory('Plumber')} />
          <Chip label="Electrician" active={selectedCategory === 'Electrician'} onPress={() => setSelectedCategory('Electrician')} />
          <Chip label="Builder" active={selectedCategory === 'Builder'} onPress={() => setSelectedCategory('Builder')} />
          <Chip label="Heating" active={selectedCategory === 'Heating'} onPress={() => setSelectedCategory('Heating')} />
        </ScrollView>
      </View>

      {listMode ? (
        <ScrollView style={styles.directoryList} contentContainerStyle={{ paddingBottom: 100 }}>
          <Text style={styles.directoryTitle}>Nearby tradespeople <Text style={styles.directoryCount}>({filtered.length} active)</Text></Text>
          {filtered.map(trade => <DirectoryRow key={trade.id} trade={trade} onPress={() => openTrade(trade)} />)}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <MapMock trades={filtered.length ? filtered : trades} onTrade={openTrade} />
          <View style={styles.mapBottomCard}>
            <TradeSummary trade={filtered[0] || trades[0]} onPress={() => openTrade(filtered[0] || trades[0])} />
          </View>
        </View>
      )}
    </CustomerShell>
  );
}

function MapMock({
  trades: mapTrades,
  onTrade,
  compact = false,
}: {
  trades: Trade[];
  onTrade: (trade: Trade) => void;
  compact?: boolean;
}) {
  const fallback = {
    latitude: 52.6369,
    longitude: -1.1398,
  };

  const [region, setRegion] = useState<Region>({
    latitude: fallback.latitude,
    longitude: fallback.longitude,
    latitudeDelta: compact ? 0.035 : 0.055,
    longitudeDelta: compact ? 0.035 : 0.055,
  });
  const [tradeAnchor, setTradeAnchor] = useState(fallback);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'ready' | 'denied'>('loading');

  useEffect(() => {
    let mounted = true;

    const loadLocation = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (permission.status !== 'granted') {
          if (mounted) setLocationStatus('denied');
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!mounted) return;

        const current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setTradeAnchor(current);
        setRegion({
          ...current,
          latitudeDelta: compact ? 0.035 : 0.055,
          longitudeDelta: compact ? 0.035 : 0.055,
        });
        setLocationStatus('ready');
      } catch {
        if (mounted) setLocationStatus('denied');
      }
    };

    loadLocation();

    return () => {
      mounted = false;
    };
  }, [compact]);

  const offsets = [
    { lat: 0.006, lng: -0.004 },
    { lat: -0.004, lng: -0.006 },
    { lat: 0.003, lng: 0.007 },
    { lat: -0.007, lng: 0.004 },
    { lat: 0.008, lng: 0.005 },
  ];

  return (
    <View style={[styles.mapMock, compact && styles.mapMockCompact]}>
      <MapView
        style={styles.mapCanvas}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={locationStatus === 'ready'}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {mapTrades.slice(0, 5).map((trade, index) => {
          const offset = offsets[index] ?? { lat: 0, lng: 0 };
          return (
            <Marker
              key={trade.id}
              coordinate={{
                latitude: tradeAnchor.latitude + offset.lat,
                longitude: tradeAnchor.longitude + offset.lng,
              }}
              onPress={() => onTrade(trade)}
            >
              <View style={styles.realMarkerWrap}>
                <View style={[styles.markerRing, { borderColor: trade.accent }]}>
                  <Image source={{ uri: trade.image }} style={styles.markerImage} />
                  <View style={styles.markerOnline} />
                </View>
                {!compact || index < 3 ? (
                  <View style={styles.markerLabel}>
                    <Text style={styles.markerRole}>{trade.role}</Text>
                    <Text style={styles.markerDistance}>{trade.distance} mi</Text>
                  </View>
                ) : null}
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.mapLocationPill}>
        <AppIcon icon={{ ios: 'location.fill', android: 'location_on' }} size={14} color={C.navy2} />
        <Text style={styles.mapLocationText}>
          {locationStatus === 'ready'
            ? 'Your location'
            : locationStatus === 'loading'
              ? 'Finding your location…'
              : 'Location unavailable'}
        </Text>
      </View>

      <View style={styles.mapAvailabilityPill}>
        <View style={styles.mapAvailabilityDot} />
        <Text style={styles.mapAvailabilityText}>Available now</Text>
      </View>
    </View>
  );
}

function TradeProfileScreen({
  trade,
  back,
  message,
  book,
}: {
  trade: Trade;
  back: () => void;
  message: () => void;
  book: () => void;
}) {
  const [tab, setTab] = useState<'About' | 'Services' | 'Reviews' | 'Gallery'>('About');

  return (
    <CustomerShell>
      <ScrollView contentContainerStyle={{ paddingBottom: 95 }} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHero}>
          <Image source={{ uri: trade.image }} style={styles.profileHeroImage} />
          <Pressable style={styles.backCircle} onPress={back}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.profileHeroActions}>
            <View style={styles.smallCircle}><Text>♡</Text></View>
            <View style={styles.smallCircle}><Text>↗</Text></View>
          </View>
        </View>

        <View style={styles.profileSheet}>
          <Text style={styles.profileName}>{trade.name} <Text style={{ color: C.blue }}>✓</Text></Text>
          <Text style={styles.profileRole}>{trade.role}{trade.secondaryRole ? ' · ' + trade.secondaryRole : ''}</Text>
          <View style={styles.profileMetaRow}>
            <Text style={styles.ratingText}>⭐ {trade.rating} <Text style={styles.muted}>({trade.reviews} reviews)</Text></Text>
            <Text style={styles.muted}>⌖ {trade.distance} miles away</Text>
          </View>

          <View style={styles.badgeRow}>
            <Badge text="● Available now" green />
            {trade.verified ? <Badge text="✓ Verified" /> : null}
            {trade.insured ? <Badge text="◆ Insured" dark /> : null}
            {trade.gasSafe ? <Badge text="⚠ Gas Safe" gold /> : null}
          </View>

          <View style={styles.statRow}>
            <Stat icon="⚡" value={'in ' + trade.response + ' mins'} label="Typically responds" />
            <Stat icon="◷" value={trade.years + '+ years'} label="Experience" />
            <Stat icon="£" value={'from £' + trade.callout} label="Call-out" />
            <Stat icon="◇" value="Guaranteed" label="Work" />
          </View>

          <View style={styles.tabs}>
            {(['About', 'Services', 'Reviews', 'Gallery'] as const).map(t => (
              <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          {tab === 'About' ? (
            <>
              <Text style={styles.contentHeading}>About me</Text>
              <Text style={styles.bodyText}>{trade.about}</Text>
              <Text style={styles.contentHeading}>Services</Text>
              <View style={styles.serviceGrid}>
                {trade.services.map((service, i) => (
                  <View key={service} style={styles.serviceCard}>
                    <Text style={styles.serviceIcon}>{['💧', '🛁', '♨', '🔧'][i % 4]}</Text>
                    <Text style={styles.serviceText}>{service}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {tab === 'Services' ? (
            <View style={{ marginTop: 18 }}>
              {trade.services.map(service => (
                <View key={service} style={styles.lineRow}>
                  <Text style={styles.lineTitle}>{service}</Text>
                  <Text style={styles.lineRight}>From £{trade.callout}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {tab === 'Reviews' ? (
            <View style={styles.reviewCard}>
              <Text style={styles.reviewName}>Sarah L. · ⭐⭐⭐⭐⭐</Text>
              <Text style={styles.bodyText}>Fantastic service. Arrived quickly, explained the problem clearly and left everything clean.</Text>
            </View>
          ) : null}

          {tab === 'Gallery' ? (
            <View style={styles.galleryGrid}>
              {[1, 2, 3, 4].map(n => (
                <View key={n} style={styles.galleryTile}><Text style={styles.galleryEmoji}>{['🚿', '🔧', '🏠', '♨'][n - 1]}</Text></View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable style={styles.secondaryAction} onPress={() => Linking.openURL('tel:' + trade.phone)}>
          <Text style={styles.secondaryActionText}>☎ Call</Text>
        </Pressable>
        <Pressable style={styles.secondaryAction} onPress={message}>
          <Text style={styles.secondaryActionText}>◌ Message</Text>
        </Pressable>
        <Pressable style={styles.primaryAction} onPress={book}>
          <Text style={styles.primaryActionText}>▣ Book now</Text>
        </Pressable>
      </View>
    </CustomerShell>
  );
}

function UrgentScreen({
  back,
  openTrade,
  addRequest,
}: {
  back: () => void;
  openTrade: (trade: Trade) => void;
  addRequest: (request: RequestItem) => void;
}) {
  const [trade, setTrade] = useState<TradeCategory>('Plumber');
  const [issue, setIssue] = useState('Leaking pipe under kitchen sink');
  const [urgency, setUrgency] = useState('ASAP');
  const [matched, setMatched] = useState(false);

  const matches = trades.filter(t => t.role === trade).length ? trades.filter(t => t.role === trade) : trades;

  const find = () => {
    addRequest({
      id: String(Date.now()),
      trade,
      issue,
      urgency,
      status: 'Searching',
    });
    setMatched(true);
  };

  return (
    <CustomerShell>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={styles.urgentHeader}>
          <Pressable onPress={back}><Text style={styles.urgentBack}>‹</Text></Pressable>
          <View style={styles.greenBoltCircle}><Text style={{ fontSize: 30 }}>⚡</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.urgentScreenTitle}>Need someone now?</Text>
            <Text style={styles.urgentScreenSub}>Get matched with available tradespeople near you for urgent jobs.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <FormStep number="1" title="What trade do you need?">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(['Plumber', 'Electrician', 'Builder', 'Heating', 'Locksmith'] as TradeCategory[]).map(item => (
                <Chip key={item} label={item} active={trade === item} onPress={() => setTrade(item)} />
              ))}
            </ScrollView>
          </FormStep>

          <FormStep number="2" title="What's the issue?">
            <TextInput
              value={issue}
              onChangeText={setIssue}
              style={styles.issueInput}
              placeholder="Tell the tradesperson what happened"
              multiline
            />
          </FormStep>

          <FormStep number="3" title="How urgent is it?">
            <View style={styles.urgencyRow}>
              {[
                ['ASAP', 'Within 2 hours', '⚡'],
                ['Today', 'Same day', '▣'],
                ['This week', 'Flexible', '▣'],
              ].map(([name, sub, icon]) => (
                <Pressable
                  key={name}
                  style={[styles.urgencyCard, urgency === name && styles.urgencyCardActive]}
                  onPress={() => setUrgency(name)}
                >
                  <Text style={styles.urgencyIcon}>{icon}</Text>
                  <Text style={[styles.urgencyName, urgency === name && { color: '#087A4E' }]}>{name}</Text>
                  <Text style={styles.urgencySub}>{sub}</Text>
                </Pressable>
              ))}
            </View>
          </FormStep>

          <FormStep number="4" title="Add a photo (optional)">
            <View style={styles.photoRow}>
              <View style={styles.photoDemo}><Text style={{ fontSize: 40 }}>🚰</Text></View>
              <View style={styles.addPhoto}><Text style={styles.plus}>＋</Text><Text style={styles.addPhotoText}>Add photo</Text></View>
            </View>
          </FormStep>

          <FormStep number="5" title="Your location">
            <View style={styles.locationField}><Text>📍</Text><Text style={styles.locationFieldText}>Use my current location</Text><Text>⌄</Text></View>
          </FormStep>

          <Pressable style={styles.findButton} onPress={find}>
            <Text style={styles.findButtonText}>Find available tradespeople →</Text>
          </Pressable>
        </View>

        {matched ? (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>{matches.length} {trade.toLowerCase()}{matches.length === 1 ? '' : 's'} available now</Text>
            <Text style={styles.resultsSub}>Choose who you want to contact</Text>
            {matches.map(person => (
              <View key={person.id} style={styles.matchCard}>
                <TradeSummary trade={person} onPress={() => openTrade(person)} />
                <View style={styles.matchButtons}>
                  <Pressable style={styles.viewButton} onPress={() => openTrade(person)}><Text style={styles.viewButtonText}>View</Text></Pressable>
                  <Pressable style={styles.contactButton} onPress={() => Linking.openURL('tel:' + person.phone)}><Text style={styles.contactButtonText}>Contact</Text></Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </CustomerShell>
  );
}

function BookingScreen({ trade, back, complete }: { trade: Trade; back: () => void; complete: () => void }) {
  const [service, setService] = useState(trade.services[0]);

  return (
    <CustomerShell>
      <ScrollView contentContainerStyle={styles.plainPage}>
        <HeaderBack title="Book a job" back={back} />
        <View style={styles.bookTradeRow}>
          <Image source={{ uri: trade.image }} style={styles.bookAvatar} />
          <View>
            <Text style={styles.bookTradeName}>{trade.name}</Text>
            <Text style={styles.muted}>{trade.role} · {trade.distance} miles away</Text>
          </View>
        </View>

        <Text style={styles.stepLine}>● Service   ○ Date & time   ○ Details</Text>
        <Text style={styles.contentHeading}>What service do you need?</Text>

        {trade.services.concat(['Emergency call-out', 'Other']).map(item => (
          <Pressable key={item} style={[styles.radioRow, service === item && styles.radioRowActive]} onPress={() => setService(item)}>
            <View style={[styles.radio, service === item && styles.radioActive]}>{service === item ? <View style={styles.radioDot} /> : null}</View>
            <Text style={styles.radioText}>{item}</Text>
          </Pressable>
        ))}

        <Text style={styles.contentHeading}>When?</Text>
        <View style={styles.twoCol}>
          <View style={styles.pickCard}><Text style={styles.pickLabel}>Date</Text><Text style={styles.pickValue}>Tomorrow</Text></View>
          <View style={styles.pickCard}><Text style={styles.pickLabel}>Time</Text><Text style={styles.pickValue}>10:00–12:00</Text></View>
        </View>

        <Pressable style={styles.largeBlueButton} onPress={complete}><Text style={styles.largeBlueText}>Send booking request</Text></Pressable>
      </ScrollView>
    </CustomerShell>
  );
}

function RequestsScreen({ requests, navigate }: { requests: RequestItem[]; navigate: (screen: CustomerScreen) => void }) {
  return (
    <CustomerShell current="requests" navigate={navigate}>
      <ScrollView contentContainerStyle={[styles.plainPage, { paddingBottom: 100 }]}>
        <Text style={styles.pageTitle}>Your requests</Text>
        <Text style={styles.pageSub}>Urgent searches and scheduled bookings.</Text>

        {requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>◷</Text>
            <Text style={styles.emptyTitle}>No requests yet</Text>
            <Text style={styles.emptyBody}>When you request or book a tradesperson, it will appear here.</Text>
            <Pressable style={styles.largeBlueButton} onPress={() => navigate('urgent')}><Text style={styles.largeBlueText}>Need someone now?</Text></Pressable>
          </View>
        ) : (
          requests.map(item => (
            <View key={item.id} style={styles.requestCard}>
              <View style={styles.requestTop}>
                <Text style={styles.requestTrade}>{item.trade}</Text>
                <Badge text={item.status} green />
              </View>
              <Text style={styles.requestIssue}>{item.issue}</Text>
              <Text style={styles.muted}>{item.urgency}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </CustomerShell>
  );
}

function MessagesScreen({ trade, navigate }: { trade: Trade; navigate: (screen: CustomerScreen) => void }) {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<string[]>([]);

  return (
    <CustomerShell current="messages" navigate={navigate}>
      <View style={styles.chatHeader}>
        <Image source={{ uri: trade.image }} style={styles.chatAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.chatName}>{trade.name}</Text>
          <Text style={styles.onlineText}>● Online now</Text>
        </View>
        <Pressable onPress={() => Linking.openURL('tel:' + trade.phone)}><Text style={styles.chatCall}>☎</Text></Pressable>
      </View>

      <ScrollView style={styles.chatBody} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.myBubble}><Text style={styles.myBubbleText}>Hi, I have a leak under my kitchen sink. Are you available to take a look today?</Text></View>
        <View style={styles.theirRow}>
          <Image source={{ uri: trade.image }} style={styles.bubbleAvatar} />
          <View style={styles.theirBubble}><Text style={styles.theirBubbleText}>Hi, yes I can. I'm about {trade.eta} minutes away. Can you send a photo?</Text></View>
        </View>
        <View style={styles.photoBubble}><Text style={{ fontSize: 70 }}>🚰</Text></View>
        <View style={styles.theirRow}>
          <Image source={{ uri: trade.image }} style={styles.bubbleAvatar} />
          <View style={styles.theirBubble}><Text style={styles.theirBubbleText}>No problem, I'll be there in around {trade.eta} minutes.</Text></View>
        </View>
        {sent.map((text, i) => <View key={i} style={styles.myBubble}><Text style={styles.myBubbleText}>{text}</Text></View>)}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput value={message} onChangeText={setMessage} style={styles.composerInput} placeholder="Type a message..." />
        <Pressable
          style={styles.sendButton}
          onPress={() => {
            if (!message.trim()) return;
            setSent(prev => [...prev, message.trim()]);
            setMessage('');
          }}
        >
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
    </CustomerShell>
  );
}

function CustomerProfileScreen({
  navigate,
  switchToTrade,
  signOut,
}: {
  navigate: (screen: CustomerScreen) => void;
  switchToTrade: () => void;
  signOut: () => void;
}) {
  return (
    <CustomerShell current="customerProfile" navigate={navigate}>
      <ScrollView contentContainerStyle={[styles.plainPage, { paddingBottom: 100 }]}>
        <Text style={styles.pageTitle}>Profile</Text>
        <View style={styles.customerProfileCard}>
          <View style={styles.customerAvatar}><Text style={styles.customerAvatarText}>A</Text></View>
          <View>
            <Text style={styles.customerName}>Abz</Text>
            <Text style={styles.muted}>Customer account</Text>
          </View>
        </View>

        {['Personal details', 'Saved tradespeople', 'Addresses', 'Notifications', 'Help & support'].map(item => (
          <View key={item} style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>{item}</Text><Text style={styles.settingsChevron}>›</Text>
          </View>
        ))}

        <Pressable style={styles.proSwitchCard} onPress={switchToTrade}>
          <View>
            <Text style={styles.proSwitchTitle}>Are you a tradesperson?</Text>
            <Text style={styles.proSwitchSub}>Open TradeHub Pro to manage availability and nearby work.</Text>
          </View>
          <Text style={styles.proSwitchArrow}>→</Text>
        </Pressable>

        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </CustomerShell>
  );
}

function TradeShell({
  children,
  current,
  navigate,
}: {
  children: React.ReactNode;
  current: TradeScreen;
  navigate: (screen: TradeScreen) => void;
}) {
  const items: { label: string; icon: AppSymbol; route: TradeScreen }[] = [
    { label: 'Home', icon: { ios: 'house.fill', android: 'home' }, route: 'tradeHome' },
    { label: 'Jobs', icon: { ios: 'briefcase.fill', android: 'work' }, route: 'tradeJobs' },
    { label: 'Map', icon: { ios: 'map.fill', android: 'map' }, route: 'tradeMap' },
    { label: 'Messages', icon: { ios: 'message.fill', android: 'chat_bubble' }, route: 'tradeMessages' },
    { label: 'Profile', icon: { ios: 'person.fill', android: 'person' }, route: 'tradeProfile' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.navy }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.screen, { backgroundColor: C.navy }]}>{children}</View>
      <View style={styles.tradeNav}>
        {items.map(item => (
          <Pressable key={item.route} style={styles.navItem} onPress={() => navigate(item.route)}>
            <View style={styles.navIconWrap}>
              <AppIcon icon={item.icon} size={21} color={item.route === current ? C.cyan : '#8EA5B7'} />
            </View>
            <Text style={[styles.navLabel, { color: item.route === current ? C.cyan : '#8EA5B7' }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function TradeHomeScreen({
  navigate,
  switchToCustomer,
}: {
  screen: TradeScreen;
  navigate: (screen: TradeScreen) => void;
  switchToCustomer: () => void;
}) {
  const [available, setAvailable] = useState(true);
  const [duration, setDuration] = useState('1 hour');
  const [radius, setRadius] = useState(10);

  return (
    <TradeShell current="tradeHome" navigate={navigate}>
      <ScrollView contentContainerStyle={styles.tradePage}>
        <View style={styles.tradeHeaderRow}>
          <View>
            <Text style={styles.tradeBrand}>TradeHub <Text style={{ color: C.cyan }}>Pro</Text></Text>
            <Text style={styles.tradeHello}>Good evening, James</Text>
          </View>
          <Pressable style={styles.customerMini} onPress={switchToCustomer}><Text style={styles.customerMiniText}>Customer app</Text></Pressable>
        </View>

        <View style={styles.availablePanel}>
          <View style={{ flex: 1 }}>
            <Text style={styles.availablePanelTitle}>Go available</Text>
            <Text style={styles.availablePanelSub}>{available ? "You're visible on the map" : "You're hidden from customers"}</Text>
          </View>
          <Switch value={available} onValueChange={setAvailable} trackColor={{ true: C.green }} />
        </View>

        <Text style={styles.tradeLabel}>Availability duration</Text>
        <View style={styles.tradeChipWrap}>
          {['1 hour', '2 hours', '4 hours', 'All day', 'Custom'].map(item => (
            <Pressable key={item} style={[styles.tradeChip, duration === item && styles.tradeChipActive]} onPress={() => setDuration(item)}>
              <Text style={[styles.tradeChipText, duration === item && { color: C.white }]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.radiusRow}>
          <Text style={styles.tradeLabel}>Max travel distance</Text>
          <Text style={styles.radiusValue}>{radius} miles</Text>
        </View>
        <View style={styles.radiusOptions}>
          {[5, 10, 15, 25].map(value => (
            <Pressable key={value} onPress={() => setRadius(value)} style={[styles.radiusDot, radius === value && styles.radiusDotActive]}>
              <Text style={[styles.radiusDotText, radius === value && { color: C.white }]}>{value}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.tradeStats}>
          <TradeStat number="4" label="Profile views" />
          <TradeStat number="2" label="Messages" />
          <TradeStat number="1" label="Bookings" />
        </View>

        <View style={styles.tradeSectionHeader}>
          <Text style={styles.tradeSectionTitle}>Nearby opportunities</Text>
          <Pressable onPress={() => navigate('tradeJobs')}><Text style={styles.tradeLink}>View all</Text></Pressable>
        </View>

        <Opportunity title="Leak under sink" distance="0.8 miles" time="5 mins ago" price="£50–£90" />
        <Opportunity title="Boiler not working" distance="1.2 miles" time="12 mins ago" price="£80–£150" />
        <Opportunity title="General plumbing" distance="1.5 miles" time="20 mins ago" price="£60–£120" />
        <View style={{ height: 90 }} />
      </ScrollView>
    </TradeShell>
  );
}

function TradeJobsScreen({ navigate }: { screen: TradeScreen; navigate: (screen: TradeScreen) => void; switchToCustomer: () => void }) {
  return (
    <TradeShell current="tradeJobs" navigate={navigate}>
      <ScrollView contentContainerStyle={styles.tradePage}>
        <Text style={styles.tradePageTitle}>Jobs nearby</Text>
        <Text style={styles.tradePageSub}>Customers looking for plumbers within your travel radius.</Text>
        <Opportunity title="Burst pipe — urgent" distance="0.6 miles" time="2 mins ago" price="£80–£140" />
        <Opportunity title="Leaking kitchen tap" distance="1.0 miles" time="7 mins ago" price="£50–£80" />
        <Opportunity title="Radiator cold" distance="1.8 miles" time="11 mins ago" price="£70–£110" />
        <Opportunity title="Replace toilet fill valve" distance="2.3 miles" time="18 mins ago" price="£60–£100" />
      </ScrollView>
    </TradeShell>
  );
}

function TradeMapScreen({ navigate }: { screen: TradeScreen; navigate: (screen: TradeScreen) => void; switchToCustomer: () => void }) {
  return (
    <TradeShell current="tradeMap" navigate={navigate}>
      <View style={styles.tradeMapStatus}>
        <Text style={styles.tradeMapStatusTitle}>● You're visible</Text>
        <Text style={styles.tradeMapStatusSub}>Customers within 10 miles can discover your profile.</Text>
      </View>
      <View style={{ flex: 1, padding: 12, paddingBottom: 90 }}>
        <MapMock trades={trades} onTrade={() => {}} />
        <View style={styles.customerJobPin}><Text style={styles.customerJobPinIcon}>💧</Text><Text style={styles.customerJobPinText}>Leak job · 0.8 mi</Text></View>
      </View>
    </TradeShell>
  );
}

function TradeMessagesScreen({ navigate }: { screen: TradeScreen; navigate: (screen: TradeScreen) => void; switchToCustomer: () => void }) {
  return (
    <TradeShell current="tradeMessages" navigate={navigate}>
      <ScrollView contentContainerStyle={styles.tradePage}>
        <Text style={styles.tradePageTitle}>Messages</Text>
        {[
          ['Sarah P.', 'Leak under kitchen sink', 'Can you come this evening?', '2m'],
          ['Michael T.', 'Boiler repair', 'Thanks, see you at 10.', '1h'],
          ['Emma R.', 'Bathroom tap', 'I have sent a photo.', '3h'],
        ].map(([name, job, last, time]) => (
          <View key={name} style={styles.darkMessageRow}>
            <View style={styles.darkAvatar}><Text style={styles.darkAvatarText}>{name[0]}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.darkMessageName}>{name}</Text>
              <Text style={styles.darkMessageJob}>{job}</Text>
              <Text style={styles.darkMessageLast}>{last}</Text>
            </View>
            <Text style={styles.darkMessageTime}>{time}</Text>
          </View>
        ))}
      </ScrollView>
    </TradeShell>
  );
}

function TradeSettingsScreen({
  navigate,
  switchToCustomer,
  signOut,
}: {
  screen: TradeScreen;
  navigate: (screen: TradeScreen) => void;
  switchToCustomer: () => void;
  signOut: () => void;
}) {
  return (
    <TradeShell current="tradeProfile" navigate={navigate}>
      <ScrollView contentContainerStyle={styles.tradePage}>
        <Text style={styles.tradePageTitle}>Trade profile</Text>
        <View style={styles.proProfile}>
          <Image source={{ uri: trades[0].image }} style={styles.proProfileImage} />
          <View>
            <Text style={styles.proName}>James Carter</Text>
            <Text style={styles.proRole}>Plumber · Heating Engineer</Text>
            <Text style={styles.proVerify}>✓ Verified · Gas Safe</Text>
          </View>
        </View>

        {['Business details', 'Services & prices', 'Verification', 'Availability defaults', 'Notifications', 'Payouts'].map(item => (
          <View key={item} style={styles.darkSettingsRow}><Text style={styles.darkSettingsLabel}>{item}</Text><Text style={styles.darkChevron}>›</Text></View>
        ))}

        <Pressable style={styles.backCustomerButton} onPress={switchToCustomer}><Text style={styles.backCustomerText}>Switch to customer app</Text></Pressable>
        <Pressable style={styles.signOutButton} onPress={signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable>
      </ScrollView>
    </TradeShell>
  );
}

function Opportunity({ title, distance, time, price }: { title: string; distance: string; time: string; price: string }) {
  return (
    <View style={styles.opportunity}>
      <View style={styles.opportunityTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.opportunityTitle}>{title}</Text>
          <Text style={styles.opportunityMeta}>{distance} · {time}</Text>
        </View>
        <Pressable style={styles.viewJobButton}><Text style={styles.viewJobText}>View</Text></Pressable>
      </View>
      <View style={styles.opportunityBottom}>
        <Text style={styles.opportunityPrice}>{price}</Text>
        <Text style={styles.opportunityTag}>Nearby customer</Text>
      </View>
    </View>
  );
}

function TradeStat({ number, label }: { number: string; label: string }) {
  return (
    <View style={styles.tradeStat}>
      <Text style={styles.tradeStatNumber}>{number}</Text>
      <Text style={styles.tradeStatLabel}>{label}</Text>
    </View>
  );
}

function HeaderBack({ title, back }: { title: string; back: () => void }) {
  return (
    <View style={styles.headerBack}>
      <Pressable onPress={back}><Text style={styles.backPlain}>‹</Text></Pressable>
      <Text style={styles.headerBackTitle}>{title}</Text>
      <View style={{ width: 30 }} />
    </View>
  );
}

function Badge({ text, green, dark, gold }: { text: string; green?: boolean; dark?: boolean; gold?: boolean }) {
  const backgroundColor = green ? C.greenSoft : dark ? '#E9EEF5' : gold ? '#FFF4D6' : '#E6F0FF';
  const color = green ? '#087A4E' : dark ? '#233144' : gold ? '#8A6400' : '#0867D8';
  return <View style={[styles.badge, { backgroundColor }]}><Text style={[styles.badgeText, { color }]}>{text}</Text></View>;
}

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FormStep({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.formStep}>
      <View style={styles.formTitleRow}><View style={styles.stepCircle}><Text style={styles.stepNumber}>{number}</Text></View><Text style={styles.formTitle}>{title}</Text></View>
      <View style={styles.formContent}>{children}</View>
    </View>
  );
}

function DirectoryRow({ trade, onPress }: { trade: Trade; onPress: () => void }) {
  return (
    <Pressable style={styles.directoryRow} onPress={onPress}>
      <Image source={{ uri: trade.image }} style={styles.directoryAvatar} />
      <View style={{ flex: 1 }}>
        <Text style={styles.directoryName}>{trade.name}</Text>
        <Text style={styles.directoryRole}>{trade.role} · {trade.distance} mi · {trade.eta} mins</Text>
        <Text style={styles.directoryRating}>⭐ {trade.rating} ({trade.reviews})</Text>
      </View>
      <View style={styles.callCircle}><Text style={{ color: C.blue }}>☎</Text></View>
    </Pressable>
  );
}

function TradeSummary({ trade, onPress }: { trade: Trade; onPress: () => void }) {
  return (
    <Pressable style={styles.tradeSummary} onPress={onPress}>
      <Image source={{ uri: trade.image }} style={styles.summaryImage} />
      <View style={{ flex: 1 }}>
        <View style={styles.summaryNameRow}><Text style={styles.summaryName}>{trade.name}</Text><Text style={styles.verifiedTick}>✓</Text></View>
        <Text style={styles.summaryRole}>{trade.role}</Text>
        <Text style={styles.summaryMeta}>⭐ {trade.rating} ({trade.reviews}) · {trade.distance} miles</Text>
        <View style={styles.availablePill}><Text style={styles.availableText}>● Available now</Text></View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.summaryPrice}>£{trade.callout}</Text>
        <Text style={styles.summaryCallout}>Call-out</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  screen: { flex: 1, backgroundColor: C.white },
  homeContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  heroBlock: { marginTop: 28 },
  heroAccent: { color: C.cyan },
  categoryIconWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  navIconWrap: { height: 26, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { transform: [{ scale: 1.03 }] },
  logoBubble: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#0C2D4D', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#17466F' },
  logoMark: { fontSize: 23 },
  brandWhite: { color: C.white, fontSize: 29, fontWeight: '800', marginLeft: 11, letterSpacing: -0.7 },
  settingsBubble: { marginLeft: 'auto', width: 46, height: 46, borderRadius: 23, backgroundColor: '#0E3C68', borderWidth: 1, borderColor: '#1B5583', alignItems: 'center', justifyContent: 'center' },
  settingsIcon: { fontSize: 25, color: C.white },
  hero: { color: C.white, fontSize: 42, lineHeight: 45, fontWeight: '800', letterSpacing: -1.5 },
  heroSub: { color: '#B9C9D8', fontSize: 15, lineHeight: 21, marginTop: 14, marginBottom: 22 },
  searchBox: { backgroundColor: C.white, minHeight: 60, borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  searchIcon: { fontSize: 24, color: C.text },
  searchPlaceholder: { flex: 1, color: '#8B97A6', fontSize: 16, marginLeft: 11 },
  searchButton: { width: 50, alignSelf: 'stretch', margin: 6, backgroundColor: C.navy2, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  searchButtonText: { color: C.white, fontSize: 22 },
  categoryPanel: { backgroundColor: C.white, borderRadius: 22, paddingHorizontal: 10, paddingVertical: 12, marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  categoryTile: { width: '24%', height: 88, marginVertical: 4, borderRadius: 17, backgroundColor: '#F6F8FB', alignItems: 'center', justifyContent: 'center' },
  categoryTileSelected: { backgroundColor: '#E8F2FF', borderWidth: 1, borderColor: '#B5D6FF' },
  categoryIcon: { fontSize: 27 },
  categoryLabel: { fontSize: 11, fontWeight: '700', color: C.text, marginTop: 8 },
  urgentBanner: { backgroundColor: '#0E3C68', borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', marginTop: 18, borderWidth: 1, borderColor: '#174E7A' },
  urgentCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  urgentBolt: { fontSize: 30 },
  urgentTitle: { color: C.white, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  urgentSub: { color: '#C3D3E1', fontSize: 11, lineHeight: 16, marginTop: 3 },
  urgentArrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  urgentArrowText: { color: C.white, fontSize: 27 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 10 },
  darkSectionTitle: { color: C.white, fontSize: 19, fontWeight: '900', flex: 1 },
  seeAll: { color: C.blue, fontWeight: '800', fontSize: 14 },
  miniTradeCard: { width: 150, backgroundColor: C.white, borderRadius: 18, padding: 10, marginRight: 10 },
  miniImage: { width: 58, height: 58, borderRadius: 29, marginBottom: 8 },
  miniName: { fontWeight: '900', fontSize: 14, color: C.text },
  miniRole: { fontSize: 12, color: C.muted, marginTop: 2 },
  miniRating: { fontSize: 12, fontWeight: '800', marginTop: 5 },
  miniReviews: { fontWeight: '500', color: C.muted },
  miniDistance: { color: C.muted, fontSize: 11, marginTop: 5 },
  availablePill: { alignSelf: 'flex-start', backgroundColor: C.greenSoft, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 },
  availableText: { color: '#087A4E', fontSize: 10, fontWeight: '800' },
  nav: { height: 78, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: '#E9EDF2', flexDirection: 'row', paddingBottom: 7, paddingTop: 5, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -5 } },
  tradeNav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80, backgroundColor: '#061626', borderTopWidth: 1, borderTopColor: '#173A56', flexDirection: 'row', paddingBottom: 8 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  navIcon: { fontSize: 24, color: '#7C8795' },
  navLabel: { fontSize: 10, color: '#7C8795', marginTop: 3, fontWeight: '600' },
  navActive: { color: C.blue, fontWeight: '800' },
  mapTop: { paddingHorizontal: 14, paddingTop: 10, backgroundColor: C.white, zIndex: 5 },
  mapSearchRow: { flexDirection: 'row', alignItems: 'center' },
  mapSearch: { flex: 1, height: 50, borderRadius: 15, backgroundColor: C.pale, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  mapSearchText: { marginLeft: 10, color: C.muted },
  filterSquare: { width: 50, height: 50, marginLeft: 9, borderRadius: 15, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center' },
  filterIcon: { fontSize: 22 },
  chipRow: { paddingVertical: 11 },
  chip: { backgroundColor: '#F2F5F8', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, marginRight: 7 },
  chipActive: { backgroundColor: C.navy },
  chipText: { color: C.text, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: C.white },
  mapMock: { flex: 1, minHeight: 420, backgroundColor: '#E9EEF3', overflow: 'hidden', position: 'relative', borderRadius: 22 },
  mapCanvas: { ...StyleSheet.absoluteFillObject },
  realMarkerWrap: { alignItems: 'center' },
  mapLocationPill: { position: 'absolute', top: 14, left: 14, minHeight: 40, borderRadius: 20, paddingHorizontal: 12, backgroundColor: '#FFFFFFEE', flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.09, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  mapLocationText: { marginLeft: 7, color: C.navy2, fontSize: 12, fontWeight: '700' },
  mapAvailabilityPill: { position: 'absolute', top: 14, right: 14, minHeight: 40, borderRadius: 20, paddingHorizontal: 12, backgroundColor: '#FFFFFFEE', flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.09, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  mapAvailabilityDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.green, marginRight: 7 },
  mapAvailabilityText: { color: C.text, fontSize: 12, fontWeight: '700' },
  mapMockCompact: { height: 320, minHeight: 320, borderRadius: 22 },
  mapGridV1: { position: 'absolute', top: -40, bottom: -40, left: '22%', width: 30, backgroundColor: '#FFFFFF', transform: [{ rotate: '10deg' }] },
  mapGridV2: { position: 'absolute', top: -40, bottom: -40, left: '52%', width: 18, backgroundColor: '#FFFFFF', transform: [{ rotate: '-18deg' }] },
  mapGridV3: { position: 'absolute', top: -40, bottom: -40, left: '78%', width: 24, backgroundColor: '#FFFFFF', transform: [{ rotate: '8deg' }] },
  mapGridH1: { position: 'absolute', left: -60, right: -60, top: '28%', height: 24, backgroundColor: '#FFFFFF', transform: [{ rotate: '7deg' }] },
  mapGridH2: { position: 'absolute', left: -60, right: -60, top: '55%', height: 18, backgroundColor: '#FFFFFF', transform: [{ rotate: '-8deg' }] },
  mapGridH3: { position: 'absolute', left: -60, right: -60, top: '78%', height: 26, backgroundColor: '#FFFFFF', transform: [{ rotate: '4deg' }] },
  parkBlob: { position: 'absolute', width: 180, height: 160, borderRadius: 60, backgroundColor: '#D9F0D7', top: 30, right: -30, transform: [{ rotate: '20deg' }] },
  mapPlace: { position: 'absolute', top: 38, left: 20, fontSize: 20, color: '#68847B', fontWeight: '700' },
  youPulseOuter: { position: 'absolute', width: 95, height: 95, borderRadius: 48, backgroundColor: '#0A7AFF2B', alignItems: 'center', justifyContent: 'center', top: '42%', left: '39%' },
  youPulseInner: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.blue, borderWidth: 5, borderColor: C.white },
  mapMarker: { position: 'absolute', alignItems: 'center' },
  markerRing: { width: 58, height: 58, borderRadius: 29, borderWidth: 4, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  markerImage: { width: 48, height: 48, borderRadius: 24 },
  markerOnline: { position: 'absolute', width: 13, height: 13, borderRadius: 7, backgroundColor: C.green, top: -1, right: 0, borderWidth: 2, borderColor: C.white },
  markerLabel: { marginTop: 3, backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' },
  markerRole: { fontSize: 10, fontWeight: '900', color: C.text },
  markerDistance: { fontSize: 9, color: C.muted },
  locationButton: { position: 'absolute', bottom: 20, right: 18, width: 48, height: 48, borderRadius: 24, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  mapBottomCard: { position: 'absolute', left: 14, right: 14, bottom: 92, backgroundColor: C.white, borderRadius: 20, padding: 12 },
  tradeSummary: { flexDirection: 'row', alignItems: 'center' },
  summaryImage: { width: 66, height: 66, borderRadius: 20, marginRight: 12 },
  summaryNameRow: { flexDirection: 'row', alignItems: 'center' },
  summaryName: { fontWeight: '900', color: C.text, fontSize: 16 },
  verifiedTick: { color: C.blue, fontWeight: '900', marginLeft: 5 },
  summaryRole: { color: C.muted, fontSize: 12, marginTop: 2 },
  summaryMeta: { color: C.text, fontSize: 11, marginTop: 4 },
  summaryPrice: { fontSize: 20, fontWeight: '900', color: C.text },
  summaryCallout: { fontSize: 10, color: C.muted },
  directoryList: { flex: 1, backgroundColor: C.white, paddingHorizontal: 16 },
  directoryTitle: { fontSize: 24, fontWeight: '900', color: C.text, marginTop: 12, marginBottom: 8 },
  directoryCount: { color: C.muted, fontSize: 14, fontWeight: '500' },
  directoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  directoryAvatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  directoryName: { fontWeight: '900', fontSize: 15, color: C.text },
  directoryRole: { fontSize: 11, color: C.muted, marginTop: 2 },
  directoryRating: { fontSize: 11, marginTop: 4 },
  callCircle: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#BFD8FF', alignItems: 'center', justifyContent: 'center' },
  profileHero: { height: 280, backgroundColor: '#DDE7EF', position: 'relative' },
  profileHeroImage: { width: '100%', height: '100%' },
  backCircle: { position: 'absolute', top: 14, left: 15, width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFFE8', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 38, lineHeight: 38, color: C.text },
  profileHeroActions: { position: 'absolute', top: 14, right: 15, flexDirection: 'row' },
  smallCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFFE8', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  profileSheet: { marginTop: -28, backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  profileName: { fontSize: 27, fontWeight: '900', color: C.text },
  profileRole: { fontSize: 16, color: C.muted, marginTop: 2 },
  profileMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 },
  ratingText: { color: C.text, fontWeight: '800' },
  muted: { color: C.muted },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  badge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, marginRight: 6, marginTop: 6 },
  badgeText: { fontSize: 10, fontWeight: '900' },
  statRow: { flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 3 },
  statIcon: { fontSize: 23 },
  statValue: { fontSize: 11, fontWeight: '900', color: C.text, textAlign: 'center', marginTop: 5 },
  statLabel: { fontSize: 9, color: C.muted, textAlign: 'center', marginTop: 2 },
  tabs: { flexDirection: 'row', marginTop: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabActive: { borderBottomWidth: 3, borderBottomColor: C.blue },
  tabText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: C.blue, fontWeight: '900' },
  contentHeading: { color: C.text, fontSize: 17, fontWeight: '900', marginTop: 18, marginBottom: 8 },
  bodyText: { color: '#4E5B6C', fontSize: 13, lineHeight: 20 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  serviceCard: { width: '24%', minHeight: 90, backgroundColor: C.pale, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 6 },
  serviceIcon: { fontSize: 24 },
  serviceText: { fontSize: 10, fontWeight: '800', color: C.text, textAlign: 'center', marginTop: 7 },
  lineRow: { height: 58, borderBottomWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center' },
  lineTitle: { flex: 1, fontWeight: '800', color: C.text },
  lineRight: { color: C.muted },
  reviewCard: { marginTop: 18, padding: 16, borderRadius: 16, backgroundColor: C.pale },
  reviewName: { fontWeight: '900', marginBottom: 8 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 8 },
  galleryTile: { width: '48%', aspectRatio: 1.3, backgroundColor: C.pale, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  galleryEmoji: { fontSize: 55 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 84, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.line, padding: 10, flexDirection: 'row' },
  secondaryAction: { flex: 1, borderWidth: 1, borderColor: '#BFD7F6', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  secondaryActionText: { color: C.blue, fontWeight: '900' },
  primaryAction: { flex: 1.25, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: C.white, fontWeight: '900' },
  urgentHeader: { backgroundColor: C.navy, padding: 18, paddingBottom: 24, flexDirection: 'row', alignItems: 'center' },
  urgentBack: { color: C.white, fontSize: 36, marginRight: 12 },
  greenBoltCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#073B42', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  urgentScreenTitle: { color: C.white, fontWeight: '900', fontSize: 24 },
  urgentScreenSub: { color: '#D2DCE7', fontSize: 12, lineHeight: 17, marginTop: 4 },
  formCard: { backgroundColor: C.white, marginTop: -10, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  formStep: { marginBottom: 19 },
  formTitleRow: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { color: C.white, fontWeight: '900', fontSize: 12 },
  formTitle: { color: C.text, fontWeight: '900', marginLeft: 10 },
  formContent: { marginLeft: 36, marginTop: 9 },
  issueInput: { minHeight: 70, borderWidth: 1, borderColor: '#D6DEE8', borderRadius: 12, padding: 12, color: C.text, textAlignVertical: 'top' },
  urgencyRow: { flexDirection: 'row', justifyContent: 'space-between' },
  urgencyCard: { width: '32%', minHeight: 90, borderRadius: 12, borderWidth: 1, borderColor: '#D9E1EA', alignItems: 'center', justifyContent: 'center', padding: 7 },
  urgencyCardActive: { borderColor: C.green, backgroundColor: '#E9FFF5' },
  urgencyIcon: { fontSize: 21 },
  urgencyName: { fontWeight: '900', fontSize: 12, marginTop: 4 },
  urgencySub: { color: C.muted, fontSize: 9, marginTop: 3, textAlign: 'center' },
  photoRow: { flexDirection: 'row' },
  photoDemo: { width: 100, height: 85, borderRadius: 12, backgroundColor: '#EEE7DF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  addPhoto: { width: 100, height: 85, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#B9C9DA', alignItems: 'center', justifyContent: 'center' },
  plus: { fontSize: 29, color: C.text },
  addPhotoText: { color: C.muted, fontSize: 11 },
  locationField: { height: 52, borderWidth: 1, borderColor: '#D6DEE8', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  locationFieldText: { flex: 1, marginLeft: 8, color: C.text },
  findButton: { height: 56, borderRadius: 13, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  findButtonText: { color: C.white, fontWeight: '900', fontSize: 15 },
  resultsSection: { padding: 16, backgroundColor: '#F7FAFC' },
  resultsTitle: { fontSize: 20, fontWeight: '900', color: C.text },
  resultsSub: { color: C.muted, marginTop: 3, marginBottom: 12 },
  matchCard: { backgroundColor: C.white, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  matchButtons: { flexDirection: 'row', marginTop: 12 },
  viewButton: { flex: 1, borderWidth: 1, borderColor: '#BFD7F6', borderRadius: 10, height: 42, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  viewButtonText: { color: C.text, fontWeight: '800' },
  contactButton: { flex: 1, backgroundColor: C.blue, borderRadius: 10, height: 42, alignItems: 'center', justifyContent: 'center' },
  contactButtonText: { color: C.white, fontWeight: '900' },
  plainPage: { padding: 18 },
  headerBack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backPlain: { fontSize: 36, color: C.text },
  headerBackTitle: { fontSize: 22, fontWeight: '900', color: C.text },
  bookTradeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  bookAvatar: { width: 58, height: 58, borderRadius: 29, marginRight: 12 },
  bookTradeName: { fontSize: 17, fontWeight: '900', color: C.text },
  stepLine: { fontSize: 11, color: C.muted, marginBottom: 12 },
  radioRow: { minHeight: 54, borderWidth: 1, borderColor: C.line, borderRadius: 11, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, marginBottom: 8 },
  radioRowActive: { borderColor: C.blue, backgroundColor: '#F2F7FF' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#9DABBC', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  radioActive: { borderColor: C.blue },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.blue },
  radioText: { color: C.text, fontWeight: '700' },
  twoCol: { flexDirection: 'row', gap: 9 },
  pickCard: { flex: 1, backgroundColor: C.pale, borderRadius: 13, padding: 14 },
  pickLabel: { color: C.muted, fontSize: 11 },
  pickValue: { color: C.text, fontWeight: '900', marginTop: 4 },
  largeBlueButton: { minHeight: 55, borderRadius: 13, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  largeBlueText: { color: C.white, fontWeight: '900' },
  pageTitle: { color: C.text, fontWeight: '900', fontSize: 28 },
  pageSub: { color: C.muted, marginTop: 4, marginBottom: 16 },
  emptyCard: { backgroundColor: C.pale, borderRadius: 18, padding: 22, alignItems: 'center', marginTop: 35 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 19, fontWeight: '900', color: C.text, marginTop: 9 },
  emptyBody: { color: C.muted, textAlign: 'center', lineHeight: 20, marginTop: 7 },
  requestCard: { borderRadius: 16, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, padding: 15, marginBottom: 10 },
  requestTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  requestTrade: { fontWeight: '900', color: C.text, fontSize: 16 },
  requestIssue: { color: C.text, marginTop: 7, marginBottom: 4 },
  chatHeader: { height: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  chatAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
  chatName: { fontWeight: '900', color: C.text },
  onlineText: { color: C.green, fontSize: 11, marginTop: 2 },
  chatCall: { color: C.blue, fontSize: 25 },
  chatBody: { flex: 1, backgroundColor: '#F5F7FA', padding: 14 },
  myBubble: { alignSelf: 'flex-end', maxWidth: '78%', borderRadius: 16, borderBottomRightRadius: 5, backgroundColor: '#DDEBFF', padding: 12, marginBottom: 12 },
  myBubbleText: { color: C.text, lineHeight: 19 },
  theirRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  bubbleAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 6 },
  theirBubble: { maxWidth: '76%', backgroundColor: C.white, borderRadius: 16, borderBottomLeftRadius: 5, padding: 12 },
  theirBubbleText: { color: C.text, lineHeight: 19 },
  photoBubble: { alignSelf: 'flex-end', width: 170, height: 130, borderRadius: 16, backgroundColor: '#EFE7DF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  composer: { height: 72, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  composerInput: { flex: 1, height: 45, borderRadius: 22, backgroundColor: C.pale, paddingHorizontal: 16 },
  sendButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  sendText: { color: C.white, fontSize: 23, fontWeight: '900' },
  customerProfileCard: { backgroundColor: C.pale, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 12 },
  customerAvatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  customerAvatarText: { color: C.white, fontWeight: '900', fontSize: 25 },
  customerName: { fontSize: 19, fontWeight: '900', color: C.text },
  settingsRow: { height: 58, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center' },
  settingsLabel: { flex: 1, fontWeight: '700', color: C.text },
  settingsChevron: { fontSize: 25, color: '#8995A5' },
  proSwitchCard: { backgroundColor: C.navy, borderRadius: 18, padding: 18, marginTop: 25, flexDirection: 'row', alignItems: 'center' },
  proSwitchTitle: { color: C.white, fontSize: 17, fontWeight: '900' },
  proSwitchSub: { color: '#B9CAD9', fontSize: 12, lineHeight: 17, marginTop: 4, maxWidth: 260 },
  proSwitchArrow: { color: C.cyan, fontSize: 30, marginLeft: 'auto' },
  tradePage: { padding: 18, paddingBottom: 100 },
  tradeHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  tradeBrand: { color: C.white, fontSize: 24, fontWeight: '900' },
  tradeHello: { color: '#9FB5C7', marginTop: 4 },
  customerMini: { marginLeft: 'auto', borderWidth: 1, borderColor: '#31536E', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  customerMiniText: { color: C.cyan, fontSize: 11, fontWeight: '800' },
  availablePanel: { backgroundColor: '#0C2B45', borderRadius: 18, padding: 17, flexDirection: 'row', alignItems: 'center' },
  availablePanelTitle: { color: C.white, fontSize: 24, fontWeight: '900' },
  availablePanelSub: { color: C.green, fontSize: 12, marginTop: 4 },
  tradeLabel: { color: '#D9E4EC', fontWeight: '800', marginTop: 19, marginBottom: 9 },
  tradeChipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  tradeChip: { borderRadius: 10, backgroundColor: '#102E47', paddingHorizontal: 14, paddingVertical: 10, marginRight: 7, marginBottom: 7 },
  tradeChipActive: { backgroundColor: C.blue },
  tradeChipText: { color: '#BFD0DD', fontWeight: '700', fontSize: 12 },
  radiusRow: { flexDirection: 'row', alignItems: 'center' },
  radiusValue: { marginLeft: 'auto', color: C.white, fontWeight: '900', marginTop: 19 },
  radiusOptions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  radiusDot: { width: 50, height: 38, borderRadius: 19, backgroundColor: '#102E47', alignItems: 'center', justifyContent: 'center' },
  radiusDotActive: { backgroundColor: C.blue },
  radiusDotText: { color: '#BFD0DD', fontWeight: '900' },
  tradeStats: { flexDirection: 'row', marginTop: 23, gap: 8 },
  tradeStat: { flex: 1, backgroundColor: '#0C2B45', borderRadius: 16, padding: 14 },
  tradeStatNumber: { color: C.white, fontSize: 24, fontWeight: '900' },
  tradeStatLabel: { color: '#8FA9BD', fontSize: 10, marginTop: 3 },
  tradeSectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 25, marginBottom: 10 },
  tradeSectionTitle: { color: C.white, fontSize: 18, fontWeight: '900', flex: 1 },
  tradeLink: { color: C.cyan, fontWeight: '800' },
  opportunity: { backgroundColor: '#0D2A43', borderRadius: 17, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#173F5F' },
  opportunityTop: { flexDirection: 'row', alignItems: 'center' },
  opportunityTitle: { color: C.white, fontSize: 16, fontWeight: '900' },
  opportunityMeta: { color: '#94ABBD', fontSize: 11, marginTop: 4 },
  viewJobButton: { backgroundColor: C.blue, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  viewJobText: { color: C.white, fontSize: 11, fontWeight: '900' },
  opportunityBottom: { flexDirection: 'row', marginTop: 12, alignItems: 'center' },
  opportunityPrice: { color: C.green, fontWeight: '900', flex: 1 },
  opportunityTag: { color: '#9EB1C1', fontSize: 10 },
  tradePageTitle: { color: C.white, fontSize: 27, fontWeight: '900', marginBottom: 4 },
  tradePageSub: { color: '#9DB2C3', marginBottom: 18, lineHeight: 19 },
  tradeMapStatus: { margin: 14, marginBottom: 0, backgroundColor: '#0C2B45', borderRadius: 16, padding: 14 },
  tradeMapStatusTitle: { color: C.green, fontWeight: '900', fontSize: 16 },
  tradeMapStatusSub: { color: '#A5BAC9', fontSize: 11, marginTop: 4 },
  customerJobPin: { position: 'absolute', bottom: 115, left: 35, backgroundColor: C.navy, borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'center' },
  customerJobPinIcon: { fontSize: 20, marginRight: 7 },
  customerJobPinText: { color: C.white, fontWeight: '900', fontSize: 11 },
  darkMessageRow: { backgroundColor: '#0D2A43', borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  darkAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  darkAvatarText: { color: C.white, fontWeight: '900', fontSize: 18 },
  darkMessageName: { color: C.white, fontWeight: '900' },
  darkMessageJob: { color: C.cyan, fontSize: 11, marginTop: 2 },
  darkMessageLast: { color: '#9DB0C1', fontSize: 11, marginTop: 4 },
  darkMessageTime: { color: '#718A9D', fontSize: 10 },
  proProfile: { backgroundColor: '#0D2A43', borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 10 },
  proProfileImage: { width: 65, height: 65, borderRadius: 33, marginRight: 12 },
  proName: { color: C.white, fontWeight: '900', fontSize: 18 },
  proRole: { color: '#9EB2C1', marginTop: 3 },
  proVerify: { color: C.green, fontSize: 11, marginTop: 5 },
  darkSettingsRow: { height: 58, borderBottomWidth: 1, borderBottomColor: '#173A56', flexDirection: 'row', alignItems: 'center' },
  darkSettingsLabel: { flex: 1, color: C.white, fontWeight: '700' },
  darkChevron: { color: '#8FA4B5', fontSize: 26 },
  backCustomerButton: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: C.cyan, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  backCustomerText: { color: C.cyan, fontWeight: '900' },
  signOutButton: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#D5DCE5', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  signOutText: { color: C.red, fontWeight: '900' },
});

