import React, { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import AuthScreen from './AuthScreen';
import { supabase } from './lib/supabase';
import * as Updates from 'expo-updates';
import { SymbolView } from 'expo-symbols';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
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
  mapLatitude?: number;
  mapLongitude?: number;
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

type DispatchStage = 'form' | 'searching' | 'matched';

type LiveDispatchCandidate = {
  userId: string;
  trade: Trade;
  distance: number;
  eta: number;
};

const distanceMilesBetween = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const estimatedDispatchEta = (distanceMiles: number) =>
  Math.max(8, Math.min(60, Math.round(7 + distanceMiles * 4)));

const dispatchStatusLabel = (status: string) => {
  if (status === 'matched') return 'Matched';
  if (status === 'en_route') return 'On the way';
  if (status === 'arrived') return 'Arrived';
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'expired') return 'Expired';
  return 'Searching';
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

const demoTradeBase = {
  available: true,
  verified: true,
  insured: true,
  phone: '07123456789',
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
    gasSafe: true,
    response: 5,
    years: 10,
    about: 'Experienced plumber covering leaks, blockages, bathrooms and general plumbing repairs.',
    services: ['Leaks & repairs', 'Bathrooms', 'Radiators', 'Installations'],
    mapLatitude: 52.6363,
    mapLongitude: -1.1332,
    ...demoTradeBase,
  },
  {
    id: 'sarah',
    name: 'Sarah Mitchell',
    role: 'Electrician',
    distance: 0.8,
    eta: 9,
    rating: 4.8,
    reviews: 96,
    image: 'https://i.pravatar.cc/600?img=47',
    accent: '#10B981',
    callout: 65,
    response: 7,
    years: 8,
    about: 'Domestic electrician for faults, sockets, lighting and urgent call-outs.',
    services: ['Fault finding', 'Sockets', 'Lighting', 'Rewires'],
    mapLatitude: 52.6418,
    mapLongitude: -1.1188,
    ...demoTradeBase,
  },
  {
    id: 'daniel',
    name: 'Daniel Brooks',
    role: 'Builder',
    distance: 1.2,
    eta: 12,
    rating: 4.7,
    reviews: 88,
    image: 'https://i.pravatar.cc/600?img=11',
    accent: '#16A085',
    callout: 60,
    response: 10,
    years: 12,
    about: 'General builder for brickwork, repairs and property maintenance.',
    services: ['Brickwork', 'Repairs', 'Extensions', 'Maintenance'],
    mapLatitude: 52.6293,
    mapLongitude: -1.1148,
    ...demoTradeBase,
  },
  {
    id: 'marcus',
    name: 'Marcus Green',
    role: 'Heating',
    distance: 1.6,
    eta: 15,
    rating: 4.9,
    reviews: 102,
    image: 'https://i.pravatar.cc/600?img=68',
    accent: '#F97316',
    callout: 70,
    gasSafe: true,
    response: 8,
    years: 14,
    about: 'Heating engineer specialising in boilers, radiators and heating faults.',
    services: ['Boilers', 'Radiators', 'Heating faults', 'Servicing'],
    mapLatitude: 52.6212,
    mapLongitude: -1.1292,
    ...demoTradeBase,
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
    response: 6,
    years: 7,
    about: 'Local locksmith for lockouts, replacements, upgrades and emergency access.',
    services: ['Lockouts', 'Lock changes', 'UPVC locks', 'Security upgrades'],
    mapLatitude: 52.6505,
    mapLongitude: -1.1284,
    ...demoTradeBase,
  },

  // City centre / West End
  { id:'alex-p', name:'Alex Morgan', role:'Plumber', distance:1.1, eta:11, rating:4.7, reviews:63, image:'https://i.pravatar.cc/600?img=13', accent:'#0A7AFF', callout:55, response:9, years:9, about:'Local plumbing repairs and maintenance.', services:['Leaks','Taps','Toilets','Pipework'], mapLatitude:52.6338, mapLongitude:-1.1458, ...demoTradeBase },
  { id:'nina-e', name:'Nina Patel', role:'Electrician', distance:1.4, eta:13, rating:4.9, reviews:118, image:'https://i.pravatar.cc/600?img=49', accent:'#10B981', callout:70, response:6, years:11, about:'Domestic electrical work and fault finding.', services:['Sockets','Lighting','Faults','Consumer units'], mapLatitude:52.6355, mapLongitude:-1.1515, ...demoTradeBase },
  { id:'owen-c', name:'Owen Clarke', role:'Carpenter', distance:1.5, eta:16, rating:4.8, reviews:55, image:'https://i.pravatar.cc/600?img=15', accent:'#8B5E3C', callout:60, response:12, years:13, about:'Carpentry, doors, fitted storage and repairs.', services:['Doors','Shelving','Joinery','Repairs'], mapLatitude:52.6302, mapLongitude:-1.1546, ...demoTradeBase },
  { id:'mia-r', name:'Mia Foster', role:'Roofer', distance:1.9, eta:19, rating:4.6, reviews:47, image:'https://i.pravatar.cc/600?img=45', accent:'#64748B', callout:80, response:14, years:8, about:'Roof repairs, leaks and gutter work.', services:['Leaks','Tiles','Gutters','Repairs'], mapLatitude:52.6427, mapLongitude:-1.1532, ...demoTradeBase },

  // Highfields / Spinney Hills
  { id:'aaron-b', name:'Aaron Singh', role:'Builder', distance:1.0, eta:10, rating:4.8, reviews:91, image:'https://i.pravatar.cc/600?img=14', accent:'#16A085', callout:65, response:8, years:15, about:'General building and property repairs.', services:['Brickwork','Repairs','Plastering','Maintenance'], mapLatitude:52.6278, mapLongitude:-1.1235, ...demoTradeBase },
  { id:'leah-p', name:'Leah Williams', role:'Plumber', distance:0.9, eta:8, rating:4.9, reviews:139, image:'https://i.pravatar.cc/600?img=44', accent:'#0A7AFF', callout:50, response:5, years:10, about:'Fast local plumbing and emergency leak repairs.', services:['Leaks','Taps','Showers','Toilets'], mapLatitude:52.6257, mapLongitude:-1.1192, ...demoTradeBase },
  { id:'sam-h', name:'Sam Roberts', role:'Heating', distance:1.3, eta:12, rating:4.7, reviews:77, image:'https://i.pravatar.cc/600?img=16', accent:'#F97316', callout:75, gasSafe:true, response:9, years:12, about:'Boiler and heating engineer.', services:['Boilers','Heating','Radiators','Servicing'], mapLatitude:52.6238, mapLongitude:-1.1152, ...demoTradeBase },
  { id:'zoe-l', name:'Zoe Evans', role:'Locksmith', distance:1.7, eta:15, rating:4.8, reviews:59, image:'https://i.pravatar.cc/600?img=48', accent:'#7C3AED', callout:60, response:7, years:6, about:'Lockouts and home security upgrades.', services:['Lockouts','Locks','UPVC','Security'], mapLatitude:52.6318, mapLongitude:-1.1116, ...demoTradeBase },

  // Belgrave / Rushey Mead
  { id:'jay-p', name:'Jay Shah', role:'Plumber', distance:2.2, eta:16, rating:4.9, reviews:143, image:'https://i.pravatar.cc/600?img=17', accent:'#0A7AFF', callout:55, response:5, years:14, about:'Plumbing and bathroom specialist.', services:['Bathrooms','Leaks','Pipework','Showers'], mapLatitude:52.6504, mapLongitude:-1.1197, ...demoTradeBase },
  { id:'amy-e', name:'Amy Collins', role:'Electrician', distance:2.4, eta:18, rating:4.7, reviews:69, image:'https://i.pravatar.cc/600?img=43', accent:'#10B981', callout:65, response:10, years:9, about:'Domestic electrician and testing.', services:['Lighting','Sockets','Testing','Faults'], mapLatitude:52.6577, mapLongitude:-1.1125, ...demoTradeBase },
  { id:'dylan-r', name:'Dylan Reed', role:'Roofer', distance:2.6, eta:21, rating:4.6, reviews:52, image:'https://i.pravatar.cc/600?img=18', accent:'#64748B', callout:85, response:15, years:11, about:'Roof repairs and guttering.', services:['Roof repairs','Tiles','Gutters','Flat roofs'], mapLatitude:52.6627, mapLongitude:-1.1264, ...demoTradeBase },
  { id:'hana-c', name:'Hana Khan', role:'Carpenter', distance:2.1, eta:17, rating:4.9, reviews:81, image:'https://i.pravatar.cc/600?img=46', accent:'#8B5E3C', callout:60, response:8, years:10, about:'Joinery and fitted furniture.', services:['Joinery','Doors','Storage','Repairs'], mapLatitude:52.6552, mapLongitude:-1.1337, ...demoTradeBase },

  // Humberstone / North Evington
  { id:'ryan-p', name:'Ryan Cooper', role:'Plumber', distance:1.3, eta:11, rating:4.8, reviews:105, image:'https://i.pravatar.cc/600?img=19', accent:'#0A7AFF', callout:55, response:7, years:11, about:'Plumbing repairs and call-outs.', services:['Leaks','Taps','Toilets','Radiators'], mapLatitude:52.6392, mapLongitude:-1.0965, ...demoTradeBase },
  { id:'ava-b', name:'Ava Turner', role:'Builder', distance:1.6, eta:15, rating:4.7, reviews:72, image:'https://i.pravatar.cc/600?img=42', accent:'#16A085', callout:70, response:12, years:9, about:'Building repairs and renovation work.', services:['Repairs','Brickwork','Renovation','Plastering'], mapLatitude:52.6336, mapLongitude:-1.1016, ...demoTradeBase },
  { id:'harry-e', name:'Harry Price', role:'Electrician', distance:1.5, eta:13, rating:4.9, reviews:112, image:'https://i.pravatar.cc/600?img=20', accent:'#10B981', callout:70, response:6, years:13, about:'Electrical faults, upgrades and installations.', services:['Faults','Sockets','Lighting','Upgrades'], mapLatitude:52.6451, mapLongitude:-1.1027, ...demoTradeBase },
  { id:'ruby-h', name:'Ruby Hall', role:'Heating', distance:1.8, eta:16, rating:4.8, reviews:83, image:'https://i.pravatar.cc/600?img=41', accent:'#F97316', callout:75, gasSafe:true, response:8, years:10, about:'Gas and heating engineer.', services:['Boilers','Gas','Heating','Servicing'], mapLatitude:52.6495, mapLongitude:-1.0944, ...demoTradeBase },

  // Evington / Crown Hills
  { id:'tom-l', name:'Tom Bennett', role:'Locksmith', distance:1.9, eta:14, rating:4.6, reviews:41, image:'https://i.pravatar.cc/600?img=21', accent:'#7C3AED', callout:55, response:9, years:5, about:'Emergency lockouts and replacement locks.', services:['Lockouts','Locks','Keys','UPVC'], mapLatitude:52.6218, mapLongitude:-1.0907, ...demoTradeBase },
  { id:'ella-c', name:'Ella Morris', role:'Carpenter', distance:2.0, eta:18, rating:4.9, reviews:88, image:'https://i.pravatar.cc/600?img=40', accent:'#8B5E3C', callout:65, response:10, years:12, about:'Carpentry, doors and custom storage.', services:['Doors','Storage','Joinery','Repairs'], mapLatitude:52.6167, mapLongitude:-1.1045, ...demoTradeBase },
  { id:'noah-b', name:'Noah Ward', role:'Builder', distance:2.2, eta:20, rating:4.8, reviews:97, image:'https://i.pravatar.cc/600?img=22', accent:'#16A085', callout:70, response:11, years:16, about:'Extensions, brickwork and general building.', services:['Extensions','Brickwork','Repairs','Renovation'], mapLatitude:52.6142, mapLongitude:-1.0961, ...demoTradeBase },
  { id:'isla-r', name:'Isla Hughes', role:'Roofer', distance:2.4, eta:22, rating:4.7, reviews:66, image:'https://i.pravatar.cc/600?img=39', accent:'#64748B', callout:85, response:14, years:8, about:'Roof repairs, gutters and emergency leaks.', services:['Leaks','Tiles','Gutters','Flat roofs'], mapLatitude:52.6104, mapLongitude:-1.1115, ...demoTradeBase },

  // Knighton / Clarendon Park
  { id:'ben-p', name:'Ben Taylor', role:'Plumber', distance:2.6, eta:18, rating:4.9, reviews:154, image:'https://i.pravatar.cc/600?img=23', accent:'#0A7AFF', callout:55, response:5, years:15, about:'Plumbing and heating repairs.', services:['Leaks','Bathrooms','Heating','Pipework'], mapLatitude:52.6089, mapLongitude:-1.1268, ...demoTradeBase },
  { id:'grace-e', name:'Grace Murphy', role:'Electrician', distance:2.8, eta:20, rating:4.8, reviews:92, image:'https://i.pravatar.cc/600?img=38', accent:'#10B981', callout:70, response:8, years:11, about:'Domestic electrical installation and repairs.', services:['Lighting','Sockets','Rewires','Testing'], mapLatitude:52.6027, mapLongitude:-1.1328, ...demoTradeBase },
  { id:'leo-c', name:'Leo Martin', role:'Carpenter', distance:2.7, eta:21, rating:4.7, reviews:61, image:'https://i.pravatar.cc/600?img=24', accent:'#8B5E3C', callout:65, response:12, years:9, about:'Joinery, doors and fitted storage.', services:['Joinery','Doors','Shelving','Storage'], mapLatitude:52.6054, mapLongitude:-1.1432, ...demoTradeBase },
  { id:'maya-b', name:'Maya Wilson', role:'Builder', distance:3.0, eta:24, rating:4.8, reviews:75, image:'https://i.pravatar.cc/600?img=37', accent:'#16A085', callout:75, response:13, years:10, about:'Property refurbishment and building work.', services:['Refurbishment','Brickwork','Repairs','Plastering'], mapLatitude:52.6124, mapLongitude:-1.1507, ...demoTradeBase },

  // Braunstone / Western Park
  { id:'adam-h', name:'Adam Lewis', role:'Heating', distance:3.2, eta:23, rating:4.7, reviews:84, image:'https://i.pravatar.cc/600?img=25', accent:'#F97316', callout:75, gasSafe:true, response:10, years:13, about:'Boilers, heating faults and servicing.', services:['Boilers','Heating','Radiators','Servicing'], mapLatitude:52.6231, mapLongitude:-1.1764, ...demoTradeBase },
  { id:'lucy-l', name:'Lucy Walker', role:'Locksmith', distance:3.3, eta:22, rating:4.9, reviews:73, image:'https://i.pravatar.cc/600?img=36', accent:'#7C3AED', callout:60, response:7, years:8, about:'Lockouts and security upgrades.', services:['Lockouts','Locks','UPVC','Security'], mapLatitude:52.6311, mapLongitude:-1.1822, ...demoTradeBase },
  { id:'ethan-r', name:'Ethan Scott', role:'Roofer', distance:3.5, eta:25, rating:4.6, reviews:54, image:'https://i.pravatar.cc/600?img=26', accent:'#64748B', callout:85, response:15, years:10, about:'Roof leaks, tiles and gutters.', services:['Roof leaks','Tiles','Gutters','Repairs'], mapLatitude:52.6414, mapLongitude:-1.1785, ...demoTradeBase },
  { id:'sophia-p', name:'Sophia King', role:'Plumber', distance:3.4, eta:24, rating:4.8, reviews:109, image:'https://i.pravatar.cc/600?img=35', accent:'#0A7AFF', callout:55, response:8, years:12, about:'Domestic plumbing and bathroom work.', services:['Bathrooms','Leaks','Taps','Showers'], mapLatitude:52.6482, mapLongitude:-1.1701, ...demoTradeBase },

  // Beaumont Leys / Abbey
  { id:'jack-b', name:'Jack Young', role:'Builder', distance:3.6, eta:26, rating:4.7, reviews:68, image:'https://i.pravatar.cc/600?img=27', accent:'#16A085', callout:70, response:13, years:14, about:'General building and exterior repairs.', services:['Brickwork','Repairs','Fencing','Maintenance'], mapLatitude:52.6672, mapLongitude:-1.1664, ...demoTradeBase },
  { id:'chloe-e', name:'Chloe Baker', role:'Electrician', distance:3.8, eta:27, rating:4.8, reviews:95, image:'https://i.pravatar.cc/600?img=34', accent:'#10B981', callout:70, response:9, years:10, about:'Electrical repairs and installations.', services:['Sockets','Lighting','Faults','Testing'], mapLatitude:52.6743, mapLongitude:-1.1514, ...demoTradeBase },
  { id:'mason-c', name:'Mason Hill', role:'Carpenter', distance:3.7, eta:28, rating:4.6, reviews:49, image:'https://i.pravatar.cc/600?img=28', accent:'#8B5E3C', callout:60, response:16, years:7, about:'Carpentry repairs and fitted furniture.', services:['Doors','Joinery','Shelving','Repairs'], mapLatitude:52.6691, mapLongitude:-1.1377, ...demoTradeBase },
  { id:'lily-h', name:'Lily Green', role:'Heating', distance:4.0, eta:29, rating:4.9, reviews:121, image:'https://i.pravatar.cc/600?img=33', accent:'#F97316', callout:80, gasSafe:true, response:8, years:15, about:'Boiler servicing and central heating.', services:['Boilers','Heating','Servicing','Radiators'], mapLatitude:52.6637, mapLongitude:-1.1439, ...demoTradeBase },

  // A few offline profiles to test the Available filter
  { id:'offline-p', name:'Chris Adams', role:'Plumber', distance:2.5, eta:25, rating:4.6, reviews:44, image:'https://i.pravatar.cc/600?img=29', accent:'#0A7AFF', callout:50, available:false, verified:true, insured:true, response:18, years:7, phone:'07123456784', about:'Local plumber.', services:['Leaks','Taps'], mapLatitude:52.6182, mapLongitude:-1.1638 },
  { id:'offline-e', name:'Emily Stone', role:'Electrician', distance:3.1, eta:30, rating:4.5, reviews:37, image:'https://i.pravatar.cc/600?img=32', accent:'#10B981', callout:65, available:false, verified:true, insured:true, response:20, years:6, phone:'07123456785', about:'Domestic electrician.', services:['Sockets','Lighting'], mapLatitude:52.6532, mapLongitude:-1.1584 },
  { id:'offline-r', name:'Luke Parker', role:'Roofer', distance:4.2, eta:34, rating:4.7, reviews:58, image:'https://i.pravatar.cc/600?img=30', accent:'#64748B', callout:85, available:false, verified:true, insured:true, response:22, years:9, phone:'07123456786', about:'Roof repairs and gutter work.', services:['Tiles','Gutters'], mapLatitude:52.6574, mapLongitude:-1.0868 },
  { id:'offline-l', name:'Freya Moore', role:'Locksmith', distance:4.4, eta:32, rating:4.8, reviews:62, image:'https://i.pravatar.cc/600?img=31', accent:'#7C3AED', callout:60, available:false, verified:true, insured:true, response:16, years:8, phone:'07123456787', about:'Locksmith and security upgrades.', services:['Locks','UPVC'], mapLatitude:52.6073, mapLongitude:-1.0859 },
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
        message={() => {
          Alert.alert(
            'Demo profile',
            'This profile is sample data. Messaging is enabled automatically for real tradesperson accounts.'
          );
        }}
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
        navigate={setCustomerScreen}
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
    return <MessagesScreen navigate={setCustomerScreen} />;
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
        accountType={accountType}
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
                if (item.label === 'More') {
                  setSelectedCategory('All');
                  navigate('map');
                  return;
                }
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
  const [showFilters, setShowFilters] = useState(false);
  const [maxDistance, setMaxDistance] = useState(5);
  const [minRating, setMinRating] = useState(0);
  const [availableOnly, setAvailableOnly] = useState(true);
  const [selectedMapTrade, setSelectedMapTrade] = useState<Trade | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = trades.filter(trade => {
    const query = searchQuery.trim().toLowerCase();
    if (query && !trade.name.toLowerCase().includes(query) && !trade.role.toLowerCase().includes(query)) return false;
    if (selectedCategory !== 'All' && trade.role !== selectedCategory) return false;
    if (trade.distance > maxDistance) return false;
    if (trade.rating < minRating) return false;
    if (availableOnly && !trade.available) return false;
    return true;
  });

  const activeFilterCount =
    (maxDistance !== 5 ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (!availableOnly ? 1 : 0);

  useEffect(() => {
    if (selectedMapTrade && !filtered.some(trade => trade.id === selectedMapTrade.id)) {
      setSelectedMapTrade(null);
    }
  }, [selectedCategory, maxDistance, minRating, availableOnly]);

  const clearFilters = () => {
    setMaxDistance(5);
    setMinRating(0);
    setAvailableOnly(true);
  };

  return (
    <CustomerShell current="map" navigate={navigate}>
      <View style={styles.mapTop}>
        <View style={styles.mapSearchRow}>
          <View style={styles.mapSearch}>
            <AppIcon icon={{ ios: 'magnifyingglass', android: 'search' }} size={18} color={C.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.mapSearchInput}
              placeholder="Search trade or name"
              placeholderTextColor="#7F8A98"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <AppIcon icon={{ ios: 'xmark.circle.fill', android: 'cancel' }} size={17} color="#A3ADB8" />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={[styles.mapControlButton, showFilters && styles.mapControlButtonActive]}
            onPress={() => setShowFilters(true)}
          >
            <AppIcon
              icon={{ ios: 'slider.horizontal.3', android: 'tune' }}
              size={20}
              color={showFilters ? C.white : C.navy2}
            />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            style={styles.mapControlButton}
            onPress={() => {
              setSelectedMapTrade(null);
              setListMode(v => !v);
            }}
          >
            <AppIcon
              icon={listMode
                ? { ios: 'map.fill', android: 'map' }
                : { ios: 'list.bullet', android: 'view_list' }}
              size={20}
              color={C.navy2}
            />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="All trades" active={selectedCategory === 'All'} onPress={() => setSelectedCategory('All')} />
          <Chip label="Plumber" active={selectedCategory === 'Plumber'} onPress={() => setSelectedCategory('Plumber')} />
          <Chip label="Electrician" active={selectedCategory === 'Electrician'} onPress={() => setSelectedCategory('Electrician')} />
          <Chip label="Builder" active={selectedCategory === 'Builder'} onPress={() => setSelectedCategory('Builder')} />
          <Chip label="Heating" active={selectedCategory === 'Heating'} onPress={() => setSelectedCategory('Heating')} />
          <Chip label="Locksmith" active={selectedCategory === 'Locksmith'} onPress={() => setSelectedCategory('Locksmith')} />
          <Chip label="Carpenter" active={selectedCategory === 'Carpenter'} onPress={() => setSelectedCategory('Carpenter')} />
          <Chip label="Roofer" active={selectedCategory === 'Roofer'} onPress={() => setSelectedCategory('Roofer')} />
        </ScrollView>
      </View>

      {listMode ? (
        <ScrollView style={styles.directoryList} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={styles.directoryHeaderRow}>
            <Text style={styles.directoryTitle}>Nearby tradespeople</Text>
            <Text style={styles.directoryCount}>{filtered.length} found</Text>
          </View>
          {filtered.length ? (
            filtered.map(trade => <DirectoryRow key={trade.id} trade={trade} onPress={() => openTrade(trade)} />)
          ) : (
            <View style={styles.noResults}>
              <Text style={styles.noResultsTitle}>No tradespeople match those filters</Text>
              <Text style={styles.noResultsSub}>Try increasing the distance or lowering the minimum rating.</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <MapMock trades={filtered} onTrade={setSelectedMapTrade} />

          {selectedMapTrade ? (
            <View style={styles.mapPreviewCard}>
              <Pressable style={styles.mapPreviewClose} onPress={() => setSelectedMapTrade(null)}>
                <AppIcon icon={{ ios: 'xmark', android: 'close' }} size={14} color={C.muted} />
              </Pressable>

              <View style={styles.mapPreviewTop}>
                <Image source={{ uri: selectedMapTrade.image }} style={styles.mapPreviewImage} />
                <View style={styles.mapPreviewMain}>
                  <View style={styles.mapPreviewNameRow}>
                    <Text style={styles.mapPreviewName}>{selectedMapTrade.name}</Text>
                    {selectedMapTrade.verified ? (
                      <AppIcon icon={{ ios: 'checkmark.seal.fill', android: 'verified' }} size={16} color={C.blue} />
                    ) : null}
                  </View>
                  <Text style={styles.mapPreviewRole}>{selectedMapTrade.role}</Text>
                  <Text style={styles.mapPreviewMeta}>
                    ★ {selectedMapTrade.rating} ({selectedMapTrade.reviews}) · {selectedMapTrade.distance} mi · ~{selectedMapTrade.eta} min
                  </Text>
                </View>
              </View>

              <View style={styles.mapPreviewInfoRow}>
                <View style={styles.mapPreviewAvailable}>
                  <View
                    style={[
                      styles.mapPreviewDot,
                      !selectedMapTrade.available && { backgroundColor: '#9AA6B2' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.mapPreviewAvailableText,
                      !selectedMapTrade.available && { color: C.muted },
                    ]}
                  >
                    {selectedMapTrade.available ? 'Available now' : 'Not currently available'}
                  </Text>
                </View>
                <Text style={styles.mapPreviewPrice}>From £{selectedMapTrade.callout} call-out</Text>
              </View>

              <View style={styles.mapPreviewActions}>
                <Pressable
                  style={styles.mapPreviewSecondary}
                  onPress={() => Linking.openURL('tel:' + selectedMapTrade.phone)}
                >
                  <AppIcon icon={{ ios: 'phone.fill', android: 'call' }} size={17} color={C.navy2} />
                  <Text style={styles.mapPreviewSecondaryText}>Call</Text>
                </Pressable>
                <Pressable style={styles.mapPreviewPrimary} onPress={() => openTrade(selectedMapTrade)}>
                  <Text style={styles.mapPreviewPrimaryText}>View profile</Text>
                  <AppIcon icon={{ ios: 'arrow.right', android: 'arrow_forward' }} size={16} color={C.white} />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      )}

      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.filterModalRoot}>
          <Pressable style={styles.filterModalBackdrop} onPress={() => setShowFilters(false)} />
          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHandle} />
            <View style={styles.filterPanelHeader}>
              <View>
                <Text style={styles.filterPanelTitle}>Filter tradespeople</Text>
                <Text style={styles.filterPanelSub}>Only show people who fit what you need.</Text>
              </View>
              <Pressable onPress={clearFilters}>
                <Text style={styles.clearFiltersText}>Reset</Text>
              </Pressable>
            </View>

            <Text style={styles.filterSectionLabel}>Availability</Text>
            <View style={styles.filterOptionRow}>
              <Pressable
                style={[styles.filterOption, availableOnly && styles.filterOptionActive]}
                onPress={() => setAvailableOnly(true)}
              >
                <Text style={[styles.filterOptionText, availableOnly && styles.filterOptionTextActive]}>Available now</Text>
              </Pressable>
              <Pressable
                style={[styles.filterOption, !availableOnly && styles.filterOptionActive]}
                onPress={() => setAvailableOnly(false)}
              >
                <Text style={[styles.filterOptionText, !availableOnly && styles.filterOptionTextActive]}>Show all</Text>
              </Pressable>
            </View>

            <Text style={styles.filterSectionLabel}>Maximum distance</Text>
            <View style={styles.filterOptionRow}>
              {[1, 3, 5, 10].map(distance => (
                <Pressable
                  key={distance}
                  style={[styles.filterOption, maxDistance === distance && styles.filterOptionActive]}
                  onPress={() => setMaxDistance(distance)}
                >
                  <Text style={[styles.filterOptionText, maxDistance === distance && styles.filterOptionTextActive]}>
                    {distance} mi
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterSectionLabel}>Minimum rating</Text>
            <View style={styles.filterOptionRow}>
              {[
                { label: 'Any', value: 0 },
                { label: '4.0+', value: 4 },
                { label: '4.5+', value: 4.5 },
                { label: '4.8+', value: 4.8 },
              ].map(item => (
                <Pressable
                  key={item.label}
                  style={[styles.filterOption, minRating === item.value && styles.filterOptionActive]}
                  onPress={() => setMinRating(item.value)}
                >
                  <Text style={[styles.filterOptionText, minRating === item.value && styles.filterOptionTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.filterApplyButton} onPress={() => setShowFilters(false)}>
              <Text style={styles.filterApplyText}>Show {filtered.length} tradespeople</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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

  const [centre, setCentre] = useState(fallback);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'ready' | 'denied'>('loading');
  const [recenterNonce, setRecenterNonce] = useState(0);

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

        setCentre({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
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
  }, []);

  const offsets = [
    { lat: 0.006, lng: -0.004 },
    { lat: -0.004, lng: -0.006 },
    { lat: 0.003, lng: 0.007 },
    { lat: -0.007, lng: 0.004 },
    { lat: 0.008, lng: 0.005 },
  ];

  const markers = mapTrades.map((trade, index) => {
    const offset = offsets[index % offsets.length] ?? { lat: 0, lng: 0 };
    return {
      id: trade.id,
      name: trade.name,
      role: trade.role,
      distance: trade.distance,
      image: trade.image,
      accent: trade.accent,
      available: trade.available,
      lat: trade.mapLatitude ?? centre.latitude + offset.lat + Math.floor(index / offsets.length) * 0.0014,
      lng: trade.mapLongitude ?? centre.longitude + offset.lng - Math.floor(index / offsets.length) * 0.0011,
    };
  });

  const escapedMarkers = JSON.stringify(markers).replace(/</g, '\\u003c');
  const userPosition = JSON.stringify({
    lat: centre.latitude,
    lng: centre.longitude,
    visible: locationStatus === 'ready',
  });

  const html = `
<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" />
<style>
  html, body, #map { margin:0; padding:0; width:100%; height:100%; background:#F3F5F7; }
  body { overflow:hidden; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  .leaflet-control-attribution {
    font-size:6px !important;
    opacity:.42;
    background:rgba(255,255,255,.62) !important;
  }
  .maplibregl-canvas {
    filter:saturate(.88) contrast(.98) brightness(1.02);
  }
  .leaflet-marker-pane { z-index: 650 !important; }
  .leaflet-marker-pane .trade-cluster { z-index: 655 !important; }
  .leaflet-tooltip-pane { z-index: 660 !important; }
  .leaflet-popup-pane { z-index: 670 !important; }
  .leaflet-control-zoom {
    border:none !important;
    box-shadow:0 6px 20px rgba(7,27,49,.14) !important;
  }
  .leaflet-control-zoom a {
    width:36px !important;
    height:36px !important;
    line-height:36px !important;
    border:none !important;
    color:#0B2A49 !important;
  }
  .trade-pin {
    position:relative;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    min-width:52px;
    transform:translateZ(0);
  }
  .trade-avatar-wrap {
    position:relative;
    width:40px;
    height:40px;
    border-radius:20px;
    background:#fff;
    border:2px solid #FFFFFF;
    box-shadow:0 3px 10px rgba(7,27,49,.18);
  }
  .trade-avatar {
    width:36px;
    height:36px;
    border-radius:18px;
    object-fit:cover;
    display:block;
  }
  .trade-online {
    position:absolute;
    right:-1px;
    top:-1px;
    width:9px;
    height:9px;
    border-radius:5px;
    background:#16B981;
    border:2px solid #fff;
  }
  .trade-offline {
    position:absolute;
    right:-1px;
    top:-1px;
    width:9px;
    height:9px;
    border-radius:5px;
    background:#9AA6B2;
    border:2px solid #fff;
  }
  .trade-label {
    display:none;
    margin-top:4px;
    padding:3px 7px;
    border-radius:8px;
    background:rgba(255,255,255,.97);
    color:#132033;
    font-size:9px;
    line-height:11px;
    font-weight:800;
    white-space:nowrap;
    box-shadow:0 2px 7px rgba(7,27,49,.12);
  }
  body.show-trade-labels .trade-label {
    display:block;
  }
  .trade-cluster {
    background:transparent !important;
    border:none !important;
  }
  .cluster-bubble {
    min-width:60px;
    height:42px;
    padding:0 10px;
    border-radius:21px;
    display:flex;
    align-items:center;
    justify-content:center;
    gap:4px;
    background:rgba(255,255,255,.98);
    color:#0B2A49;
    border:2px solid #1684F8;
    box-shadow:0 5px 15px rgba(7,27,49,.18);
    transform:translateZ(0);
    box-sizing:border-box;
  }
  .cluster-count {
    font-size:15px;
    line-height:16px;
    font-weight:900;
  }
  .cluster-label {
    font-size:9px;
    line-height:10px;
    font-weight:800;
    color:#607286;
    text-transform:lowercase;
    white-space:nowrap;
  }
  .cluster-bubble.large {
    min-width:64px;
    height:46px;
    border-radius:23px;
    border-width:2.5px;
  }
  .dot {
    width:15px; height:15px; border-radius:8px; background:#1684F8;
    border:3px solid white; box-shadow:0 2px 8px rgba(22,132,248,.28);
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/@maplibre/maplibre-gl-leaflet/leaflet-maplibre-gl.js"></script>
<script>
  const centre = ${JSON.stringify([centre.latitude, centre.longitude])};
  const markers = ${escapedMarkers};
  const user = ${userPosition};
  const map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    preferCanvas: true
  }).setView(centre, ${compact ? 13.5 : mapTrades.length > 20 ? 12.35 : 14.75});

  L.maplibreGL({
    style: 'https://tiles.openfreemap.org/styles/liberty'
  }).addTo(map);

  map.attributionControl.setPrefix('');
  map.attributionControl.addAttribution('OpenFreeMap © OpenMapTiles · Data from OpenStreetMap');

  if (user.visible) {
    L.circle([user.lat, user.lng], {
      radius: 180,
      color: '#83BFFF',
      weight: 1,
      opacity: 0.34,
      fillColor: '#78B8FF',
      fillOpacity: 0.13,
      interactive: false
    }).addTo(map);

    const userIcon = L.divIcon({
      className: '',
      html: '<div class="dot"></div>',
      iconSize: [34,34],
      iconAnchor: [17,17]
    });
    L.marker([user.lat, user.lng], { icon:userIcon, interactive:false }).addTo(map);
  }

  const tradeLayer = L.layerGroup().addTo(map);
  let renderFrame = null;

  const cellSizeForZoom = (zoom) => {
    if (zoom <= 10.75) return 170;
    if (zoom <= 11.75) return 145;
    if (zoom <= 12.75) return 118;
    if (zoom <= 13.75) return 92;
    if (zoom <= 14.5) return 68;
    return 48;
  };

  const visibleMarkers = () => {
    const padded = map.getBounds().pad(0.18);
    return markers.filter((marker) => padded.contains([marker.lat, marker.lng]));
  };

  const clusterMarkers = (items, zoom) => {
    if (zoom >= 15) {
      return items.map((marker) => ({
        members: [marker],
        lat: marker.lat,
        lng: marker.lng,
      }));
    }

    const cellSize = cellSizeForZoom(zoom);
    const buckets = new Map();

    items.forEach((marker) => {
      const point = map.latLngToContainerPoint([marker.lat, marker.lng]);
      const key = Math.floor(point.x / cellSize) + ':' + Math.floor(point.y / cellSize);

      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(marker);
    });

    return Array.from(buckets.values()).map((members) => {
      const lat = members.reduce((sum, marker) => sum + marker.lat, 0) / members.length;
      const lng = members.reduce((sum, marker) => sum + marker.lng, 0) / members.length;
      return { members, lat, lng };
    });
  };

  const addTradeMarker = (marker) => {
    const icon = L.divIcon({
      className: '',
      html: '<div class="trade-pin"><div class="trade-avatar-wrap"><img class="trade-avatar" loading="lazy" src="' + marker.image + '" /><span class="' + (marker.available ? 'trade-online' : 'trade-offline') + '"></span></div><div class="trade-label">' + marker.role + '</div></div>',
      iconSize: [56,58],
      iconAnchor: [28,29]
    });

    L.marker([marker.lat, marker.lng], {
      icon,
      riseOnHover: true,
      keyboard: false,
      autoPanOnFocus: false,
    })
      .on('click', () => {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type:'trade', id:marker.id }));
      })
      .addTo(tradeLayer);
  };

  const addClusterMarker = (group) => {
    const count = group.members.length;
    const large = count >= 10 ? ' large' : '';
    const width = count >= 10 ? 76 : 68;

    const icon = L.divIcon({
      className: 'trade-cluster',
      html: '<div class="cluster-bubble' + large + '"><span class="cluster-count">' + count + '</span><span class="cluster-label">nearby</span></div>',
      iconSize: [width,46],
      iconAnchor: [width / 2,23]
    });

    L.marker([group.lat, group.lng], {
      icon,
      keyboard: false,
      riseOnHover: true,
      autoPanOnFocus: false,
    })
      .on('click', () => {
        if (group.members.length <= 1) {
          const only = group.members[0];
          if (only) {
            map.flyTo([only.lat, only.lng], Math.min(15, map.getZoom() + 2), {
              duration: 0.28
            });
          }
          return;
        }

        const bounds = L.latLngBounds(group.members.map((marker) => [marker.lat, marker.lng]));
        const nextZoom = Math.min(14.75, Math.max(map.getZoom() + 1.35, map.getBoundsZoom(bounds, false, [70,70])));

        map.flyTo([group.lat, group.lng], nextZoom, {
          duration: 0.32
        });
      })
      .addTo(tradeLayer);
  };

  const renderTrades = () => {
    tradeLayer.clearLayers();

    const zoom = map.getZoom();
    document.body.classList.toggle('show-trade-labels', zoom >= 15);

    const visible = visibleMarkers();
    const groups = clusterMarkers(visible, zoom);

    groups.forEach((group) => {
      const showIndividual =
        zoom >= 15 ||
        (zoom >= 14.35 && group.members.length === 1);

      if (showIndividual) {
        addTradeMarker(group.members[0]);
      } else {
        addClusterMarker(group);
      }
    });
  };

  const scheduleTradeRender = () => {
    if (renderFrame !== null) cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(() => {
      renderFrame = null;
      renderTrades();
    });
  };

  map.on('zoomend moveend resize', scheduleTradeRender);
  if (markers.length > 0) {
    const markerBounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
    if (user.visible) markerBounds.extend([user.lat, user.lng]);
    map.fitBounds(markerBounds.pad(0.08), {
      padding: [24, 24],
      maxZoom: markers.length > 20 ? 12.35 : 14.25,
      animate: false
    });
  }

  map.whenReady(scheduleTradeRender);
</script>
</body>
</html>`;

  return (
    <View style={[styles.mapMock, compact && styles.mapMockCompact]}>
      <WebView
        key={`${centre.latitude.toFixed(4)}-${centre.longitude.toFixed(4)}-${recenterNonce}-${mapTrades.map(t => t.id).join('-')}`}
        style={styles.mapCanvas}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={event => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'trade') {
              const trade = mapTrades.find(item => item.id === message.id);
              if (trade) onTrade(trade);
            }
          } catch {
            // Ignore invalid map messages.
          }
        }}
      />

      <Pressable
        style={styles.mapReferenceLocationButton}
        onPress={() => setRecenterNonce(value => value + 1)}
        accessibilityLabel="Recenter map on my location"
      >
        <AppIcon icon={{ ios: 'location.fill', android: 'my_location' }} size={20} color={C.navy2} />
      </Pressable>
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
  const [saved, setSaved] = useState(false);

  return (
    <CustomerShell>
      <ScrollView contentContainerStyle={{ paddingBottom: 95 }} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHero}>
          <Image source={{ uri: trade.image }} style={styles.profileHeroImage} />
          <Pressable style={styles.backCircle} onPress={back}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.profileHeroActions}>
            <Pressable
              style={styles.smallCircle}
              onPress={() => {
                setSaved(value => !value);
                Alert.alert(saved ? 'Removed from saved' : 'Saved', saved ? 'Removed from your saved tradespeople.' : 'Added to your saved tradespeople for this session.');
              }}
            >
              <Text style={{ fontSize: 18 }}>{saved ? '♥' : '♡'}</Text>
            </Pressable>
            <Pressable
              style={styles.smallCircle}
              onPress={() =>
                Share.share({
                  message: `${trade.name} — ${trade.role} on TradeHub. Rating ${trade.rating}/5, around ${trade.distance} miles away.`,
                })
              }
            >
              <Text style={{ fontSize: 17 }}>↗</Text>
            </Pressable>
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
  navigate,
}: {
  back: () => void;
  openTrade: (trade: Trade) => void;
  addRequest: (request: RequestItem) => void;
  navigate: (screen: CustomerScreen) => void;
}) {
  const [trade, setTrade] = useState<TradeCategory>('Plumber');
  const [issue, setIssue] = useState('Leaking pipe under kitchen sink');
  const [urgency, setUrgency] = useState('ASAP');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [jobLocation, setJobLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [stage, setStage] = useState<DispatchStage>('form');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [candidateCount, setCandidateCount] = useState(0);
  const [searchNote, setSearchNote] = useState('');
  const [matchedTrade, setMatchedTrade] = useState<Trade | null>(null);
  const [matchedTradeUserId, setMatchedTradeUserId] = useState<string | null>(null);
  const [matchStatus, setMatchStatus] = useState('searching');
  const [demoMode, setDemoMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const demoMatches = useMemo(
    () =>
      trades
        .filter(item => item.role === trade && item.available)
        .sort((a, b) => a.eta - b.eta),
    [trade]
  );

  const demoCalloutRange = useMemo(() => {
    const prices = demoMatches.map(item => item.callout).filter(Boolean);
    if (!prices.length) return null;
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [demoMatches]);

  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.75,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const resolveCurrentLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'Instant matching needs your job location so TradeHub can contact nearby available tradespeople.'
        );
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setJobLocation(next);
      return next;
    } catch {
      Alert.alert('Location unavailable', 'We could not get your location. Try again.');
      return null;
    } finally {
      setLocating(false);
    }
  };

  const loadLiveCandidates = async (
    coords: { latitude: number; longitude: number },
    searchRadius: number
  ): Promise<LiveDispatchCandidate[]> => {
    const { data: profileRows, error: profileError } = await supabase
      .from('tradesperson_profiles')
      .select(
        'user_id, display_name, primary_trade, avatar_url, public_phone, is_verified, is_insured, rating, review_count, bio'
      )
      .eq('primary_trade', trade);

    if (profileError) throw profileError;
    if (!profileRows?.length) return [];

    const ids = profileRows.map(row => row.user_id);

    const [{ data: availabilityRows, error: availabilityError }, { data: presenceRows, error: presenceError }] =
      await Promise.all([
        supabase
          .from('trade_availability')
          .select('user_id, is_available, radius_miles, available_until')
          .in('user_id', ids)
          .eq('is_available', true),
        supabase
          .from('trade_map_presence')
          .select('user_id, latitude, longitude, source_mode, updated_at')
          .in('user_id', ids),
      ]);

    if (availabilityError) throw availabilityError;
    if (presenceError) throw presenceError;

    const availabilityMap = new Map((availabilityRows ?? []).map(row => [row.user_id, row]));
    const presenceMap = new Map((presenceRows ?? []).map(row => [row.user_id, row]));
    const now = Date.now();

    return profileRows
      .map(profile => {
        const availability = availabilityMap.get(profile.user_id);
        const presence = presenceMap.get(profile.user_id);

        if (!availability?.is_available || !presence) return null;

        if (
          availability.available_until &&
          new Date(availability.available_until).getTime() <= now
        ) {
          return null;
        }

        if (
          presence.source_mode === 'live' &&
          presence.updated_at &&
          now - new Date(presence.updated_at).getTime() > 15 * 60 * 1000
        ) {
          return null;
        }

        const distance = distanceMilesBetween(coords, {
          latitude: Number(presence.latitude),
          longitude: Number(presence.longitude),
        });

        const tradeRadius = Number(availability.radius_miles) || 10;
        if (distance > Math.min(searchRadius, tradeRadius)) return null;

        const eta = estimatedDispatchEta(distance);
        const liveTrade: Trade = {
          id: 'live-' + profile.user_id,
          name: profile.display_name || 'Local tradesperson',
          role: trade,
          distance: Number(distance.toFixed(1)),
          eta,
          rating: Number(profile.rating) || 0,
          reviews: Number(profile.review_count) || 0,
          image: profile.avatar_url || 'https://i.pravatar.cc/600?u=' + profile.user_id,
          accent: C.blue,
          callout: 0,
          available: true,
          verified: Boolean(profile.is_verified),
          insured: Boolean(profile.is_insured),
          response: eta,
          years: 0,
          phone: profile.public_phone || '',
          about: profile.bio || 'Available nearby for urgent work.',
          services: ['Urgent call-out'],
          mapLatitude: Number(presence.latitude),
          mapLongitude: Number(presence.longitude),
        };

        return {
          userId: profile.user_id,
          trade: liveTrade,
          distance,
          eta,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a as LiveDispatchCandidate).distance - (b as LiveDispatchCandidate).distance) as LiveDispatchCandidate[];
  };

  const loadAcceptedTrade = async (userId: string, etaMinutes?: number | null) => {
    const [{ data: profile }, { data: presenceRows }, { data: offerRows }] = await Promise.all([
      supabase
        .from('tradesperson_profiles')
        .select(
          'user_id, display_name, primary_trade, avatar_url, public_phone, is_verified, is_insured, rating, review_count, bio'
        )
        .eq('user_id', userId)
        .single(),
      supabase
        .from('trade_locations')
        .select('latitude, longitude')
        .eq('user_id', userId)
        .limit(1),
      requestId
        ? supabase
            .from('urgent_request_offers')
            .select('distance_miles, eta_minutes')
            .eq('request_id', requestId)
            .eq('tradesperson_id', userId)
            .limit(1)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    if (!profile) return;

    const presence = presenceRows?.[0];
    const offer = offerRows?.[0];
    const distance = Number(offer?.distance_miles) || 0;
    const eta = Number(etaMinutes || offer?.eta_minutes) || estimatedDispatchEta(distance);

    setMatchedTradeUserId(userId);
    setMatchedTrade({
      id: 'live-' + userId,
      name: profile.display_name || 'Local tradesperson',
      role: (profile.primary_trade || trade) as TradeCategory,
      distance: Number(distance.toFixed(1)),
      eta,
      rating: Number(profile.rating) || 0,
      reviews: Number(profile.review_count) || 0,
      image: profile.avatar_url || 'https://i.pravatar.cc/600?u=' + userId,
      accent: C.blue,
      callout: 0,
      available: true,
      verified: Boolean(profile.is_verified),
      insured: Boolean(profile.is_insured),
      response: eta,
      years: 0,
      phone: profile.public_phone || '',
      about: profile.bio || 'Available nearby for urgent work.',
      services: ['Urgent call-out'],
      mapLatitude: presence ? Number(presence.latitude) : undefined,
      mapLongitude: presence ? Number(presence.longitude) : undefined,
    });
    setDemoMode(false);
    setStage('matched');
  };

  useEffect(() => {
    if (!requestId) return;

    const channel = supabase
      .channel('urgent-request-' + requestId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'urgent_requests',
          filter: 'id=eq.' + requestId,
        },
        async payload => {
          const row = payload.new as any;
          setMatchStatus(row.status || 'searching');

          if (
            row.accepted_tradesperson_id &&
            ['matched', 'en_route', 'arrived', 'completed'].includes(row.status)
          ) {
            if (!matchedTradeUserId || matchedTradeUserId !== row.accepted_tradesperson_id) {
              await loadAcceptedTrade(
                row.accepted_tradesperson_id,
                row.estimated_arrival_minutes
              );
            } else {
              setStage('matched');
            }
          }

          if (row.status === 'cancelled' || row.status === 'expired') {
            setStage('form');
            setRequestId(null);
            setMatchedTrade(null);
            setMatchedTradeUserId(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, matchedTradeUserId]);

  useEffect(() => {
    if (!matchedTradeUserId || demoMode || !jobLocation || stage !== 'matched') return;

    const channel = supabase
      .channel('urgent-live-location-' + matchedTradeUserId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trade_locations',
          filter: 'user_id=eq.' + matchedTradeUserId,
        },
        payload => {
          const row = payload.new as any;
          const latitude = Number(row.latitude);
          const longitude = Number(row.longitude);
          const distance = distanceMilesBetween(jobLocation, { latitude, longitude });
          const eta = estimatedDispatchEta(distance);

          setMatchedTrade(previous =>
            previous
              ? {
                  ...previous,
                  mapLatitude: latitude,
                  mapLongitude: longitude,
                  distance: Number(distance.toFixed(1)),
                  eta,
                }
              : previous
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchedTradeUserId, demoMode, jobLocation, stage]);

  const find = async () => {
    if (!issue.trim()) {
      Alert.alert('Tell us what happened', 'Add a short description of the job before searching.');
      return;
    }

    setSubmitting(true);

    try {
      const coords = jobLocation ?? (await resolveCurrentLocation());
      if (!coords) return;

      const searchRadius = urgency === 'ASAP' ? 10 : urgency === 'Today' ? 15 : 20;
      let liveCandidates: LiveDispatchCandidate[] = [];

      try {
        liveCandidates = await loadLiveCandidates(coords, searchRadius);
      } catch {
        liveCandidates = [];
      }

      setStage('searching');
      setMatchStatus('searching');
      setMatchedTrade(null);
      setMatchedTradeUserId(null);

      if (!liveCandidates.length) {
        const demoPool = demoMatches.length ? demoMatches : trades.filter(item => item.available);
        setCandidateCount(demoPool.length);
        setSearchNote(
          'Demo preview — there are no real available tradesperson accounts in this test project yet.'
        );
        setDemoMode(true);

        setTimeout(() => {
          const person = demoPool[0];
          if (!person) return;
          setMatchedTrade(person);
          setMatchStatus('matched');
          setStage('matched');
          addRequest({
            id: 'demo-' + Date.now(),
            trade,
            issue: issue.trim(),
            urgency,
            status: 'Matched (demo)',
          });
        }, 1800);

        return;
      }

      setCandidateCount(liveCandidates.length);
      setSearchNote(
        'Request sent to the closest available ' +
          trade.toLowerCase() +
          (liveCandidates.length === 1 ? '.' : 's first.')
      );
      setDemoMode(false);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Sign in required', 'Please sign in again to send an urgent request.');
        setStage('form');
        return;
      }

      const { data: request, error: requestError } = await supabase
        .from('urgent_requests')
        .insert({
          customer_id: user.id,
          trade,
          issue: issue.trim(),
          urgency,
          latitude: coords.latitude,
          longitude: coords.longitude,
          location_label: 'Current location',
          photo_url: null,
          search_radius_miles: searchRadius,
          status: 'searching',
        })
        .select('id')
        .single();

      if (requestError || !request) throw requestError || new Error('Could not create request');

      setRequestId(request.id);

      const offerRows = liveCandidates.slice(0, 8).map(candidate => ({
        request_id: request.id,
        tradesperson_id: candidate.userId,
        distance_miles: Number(candidate.distance.toFixed(2)),
        eta_minutes: candidate.eta,
        status: 'offered',
      }));

      const { error: offerError } = await supabase
        .from('urgent_request_offers')
        .insert(offerRows);

      if (offerError) throw offerError;

      addRequest({
        id: request.id,
        trade,
        issue: issue.trim(),
        urgency,
        status: 'Searching',
      });
    } catch (error: any) {
      setStage('form');
      Alert.alert(
        'Could not start the search',
        error?.message || 'Something went wrong while contacting nearby tradespeople.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cancelSearch = async () => {
    if (requestId) {
      await supabase
        .from('urgent_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', requestId);
    }

    setRequestId(null);
    setMatchedTrade(null);
    setMatchedTradeUserId(null);
    setDemoMode(false);
    setStage('form');
  };

  const messageMatchedTrade = async () => {
    if (!matchedTradeUserId) {
      Alert.alert(
        'Demo preview',
        'This is a fake tradesperson used to test the instant-match experience. Real matches will open a live chat here.'
      );
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('customer_id', user.id)
      .eq('tradesperson_id', matchedTradeUserId)
      .limit(1);

    if (!existing?.length) {
      const { error } = await supabase.from('conversations').insert({
        customer_id: user.id,
        tradesperson_id: matchedTradeUserId,
      });

      if (error) {
        Alert.alert('Could not open chat', error.message);
        return;
      }
    }

    navigate('messages');
  };

  if (stage === 'searching') {
    return (
      <CustomerShell>
        <View style={styles.dispatchSearchingPage}>
          <View style={styles.dispatchTopBar}>
            <Pressable style={styles.dispatchBackButton} onPress={cancelSearch}>
              <AppIcon icon={{ ios: 'chevron.left', android: 'arrow_back' }} size={21} color={C.navy2} />
            </Pressable>
            <Text style={styles.dispatchTopTitle}>Finding someone now</Text>
            <View style={{ width: 42 }} />
          </View>

          <View style={styles.dispatchRadar}>
            <View style={styles.dispatchRadarRingLarge} />
            <View style={styles.dispatchRadarRingMedium} />
            <View style={styles.dispatchRadarRingSmall} />
            <View style={styles.dispatchRadarCentre}>
              <AppIcon icon={{ ios: 'bolt.fill', android: 'bolt' }} size={30} color={C.white} />
            </View>
          </View>

          <ActivityIndicator size="large" color={C.blue} />
          <Text style={styles.dispatchSearchingTitle}>
            Searching nearby {trade.toLowerCase()}s
          </Text>
          <Text style={styles.dispatchSearchingSub}>
            {candidateCount
              ? 'Contacting ' + Math.min(candidateCount, 8) + ' available professional' + (candidateCount === 1 ? '' : 's') + ' near your job.'
              : 'Checking who is available near your job.'}
          </Text>

          <View style={styles.dispatchSearchInfoCard}>
            <View style={styles.dispatchInfoRow}>
              <AppIcon icon={{ ios: 'location.fill', android: 'location_on' }} size={18} color={C.blue} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dispatchInfoTitle}>Job location confirmed</Text>
                <Text style={styles.dispatchInfoSub}>Your exact location is only shared with tradespeople offered this job.</Text>
              </View>
            </View>
            <View style={styles.dispatchDivider} />
            <View style={styles.dispatchInfoRow}>
              <AppIcon icon={{ ios: 'clock.fill', android: 'schedule' }} size={18} color={C.green} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dispatchInfoTitle}>Looking for the quickest response</Text>
                <Text style={styles.dispatchInfoSub}>{searchNote || 'Nearest available professionals are contacted first.'}</Text>
              </View>
            </View>
          </View>

          <Pressable style={styles.dispatchCancelButton} onPress={cancelSearch}>
            <Text style={styles.dispatchCancelText}>Cancel request</Text>
          </Pressable>
        </View>
      </CustomerShell>
    );
  }

  if (stage === 'matched' && matchedTrade) {
    const progress = ['matched', 'en_route', 'arrived', 'completed'];
    const progressIndex = Math.max(0, progress.indexOf(matchStatus));

    return (
      <CustomerShell>
        <ScrollView contentContainerStyle={styles.dispatchMatchedPage} showsVerticalScrollIndicator={false}>
          <View style={styles.dispatchTopBar}>
            <Pressable style={styles.dispatchBackButton} onPress={back}>
              <AppIcon icon={{ ios: 'chevron.left', android: 'arrow_back' }} size={21} color={C.navy2} />
            </Pressable>
            <Text style={styles.dispatchTopTitle}>Your urgent request</Text>
            <View style={{ width: 42 }} />
          </View>

          <View style={styles.dispatchSuccessIcon}>
            <AppIcon icon={{ ios: 'checkmark', android: 'check' }} size={28} color={C.white} />
          </View>
          <Text style={styles.dispatchMatchedTitle}>
            {matchStatus === 'completed' ? 'Job completed' : matchStatus === 'arrived' ? 'Your tradesperson has arrived' : matchStatus === 'en_route' ? 'Your tradesperson is on the way' : 'Someone can help'}
          </Text>
          <Text style={styles.dispatchMatchedSub}>
            {demoMode
              ? 'Demo match using one of the Leicester test profiles.'
              : 'Your request has been accepted. You can track the job status here.'}
          </Text>

          <View style={styles.dispatchProgress}>
            {progress.map((item, index) => (
              <View key={item} style={styles.dispatchProgressItem}>
                <View style={[styles.dispatchProgressDot, index <= progressIndex && styles.dispatchProgressDotActive]}>
                  {index < progressIndex ? (
                    <AppIcon icon={{ ios: 'checkmark', android: 'check' }} size={11} color={C.white} />
                  ) : null}
                </View>
                <Text style={[styles.dispatchProgressText, index <= progressIndex && styles.dispatchProgressTextActive]}>
                  {dispatchStatusLabel(item)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.dispatchTrackingMapWrap}>
            <View style={styles.dispatchTrackingLabelRow}>
              <View style={styles.dispatchTrackingDot} />
              <Text style={styles.dispatchTrackingLabel}>
                ${demoMode ? 'Demo position' : 'Live tradesperson location'}
              </Text>
            </View>
            <MapMock trades={[matchedTrade]} onTrade={() => openTrade(matchedTrade)} compact />
          </View>

          <View style={styles.dispatchMatchCard}>
            <View style={styles.dispatchMatchTop}>
              <Image source={{ uri: matchedTrade.image }} style={styles.dispatchAvatar} />
              <View style={{ flex: 1 }}>
                <View style={styles.dispatchNameRow}>
                  <Text style={styles.dispatchName}>{matchedTrade.name}</Text>
                  {matchedTrade.verified ? (
                    <AppIcon icon={{ ios: 'checkmark.seal.fill', android: 'verified' }} size={18} color={C.blue} />
                  ) : null}
                </View>
                <Text style={styles.dispatchRole}>{matchedTrade.role}</Text>
                <Text style={styles.dispatchRating}>
                  ⭐ {matchedTrade.rating || 'New'} {matchedTrade.reviews ? '(' + matchedTrade.reviews + ')' : ''}
                </Text>
              </View>
              <View style={styles.dispatchEtaBox}>
                <Text style={styles.dispatchEtaNumber}>~{matchedTrade.eta}</Text>
                <Text style={styles.dispatchEtaLabel}>min ETA</Text>
              </View>
            </View>

            <View style={styles.dispatchTrustRow}>
              {matchedTrade.verified ? <Badge text="Verified" blue /> : null}
              {matchedTrade.insured ? <Badge text="Insured" green /> : null}
              <Badge text={matchedTrade.distance + ' mi away'} />
            </View>

            <Text style={styles.dispatchAgreementNote}>
              Agree the final price and scope with the tradesperson before work starts.
            </Text>

            <View style={styles.dispatchActionRow}>
              <Pressable
                style={styles.dispatchSecondaryAction}
                onPress={() => {
                  if (demoMode) {
                    Alert.alert('Demo preview', 'Calling is disabled for fake test profiles.');
                    return;
                  }
                  if (matchedTrade.phone) Linking.openURL('tel:' + matchedTrade.phone);
                }}
              >
                <AppIcon icon={{ ios: 'phone.fill', android: 'call' }} size={18} color={C.navy2} />
                <Text style={styles.dispatchSecondaryText}>Call</Text>
              </Pressable>
              <Pressable style={styles.dispatchSecondaryAction} onPress={messageMatchedTrade}>
                <AppIcon icon={{ ios: 'message.fill', android: 'chat_bubble' }} size={18} color={C.navy2} />
                <Text style={styles.dispatchSecondaryText}>Message</Text>
              </Pressable>
              <Pressable style={styles.dispatchPrimaryAction} onPress={() => openTrade(matchedTrade)}>
                <Text style={styles.dispatchPrimaryText}>View profile</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.dispatchJobSummary}>
            <Text style={styles.dispatchSummaryTitle}>Job details</Text>
            <Text style={styles.dispatchSummaryTrade}>{trade} · {urgency}</Text>
            <Text style={styles.dispatchSummaryIssue}>{issue}</Text>
          </View>

          {matchStatus !== 'completed' ? (
            <Pressable style={styles.dispatchCancelOutline} onPress={cancelSearch}>
              <Text style={styles.dispatchCancelOutlineText}>Cancel request</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.findButton} onPress={back}>
              <Text style={styles.findButtonText}>Back to TradeHub</Text>
            </Pressable>
          )}
        </ScrollView>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={styles.urgentHeader}>
          <Pressable onPress={back}><Text style={styles.urgentBack}>‹</Text></Pressable>
          <View style={styles.greenBoltCircle}>
            <AppIcon icon={{ ios: 'bolt.fill', android: 'bolt' }} size={25} color={C.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.urgentScreenTitle}>Need someone now?</Text>
            <Text style={styles.urgentScreenSub}>
              Send one urgent request to nearby available tradespeople. The first suitable professional to accept gets the job.
            </Text>
          </View>
        </View>

        <View style={styles.dispatchPromiseCard}>
          <View style={styles.dispatchPromiseIcon}>
            <AppIcon icon={{ ios: 'location.fill', android: 'location_on' }} size={18} color={C.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.dispatchPromiseTitle}>Instant local dispatch</Text>
            <Text style={styles.dispatchPromiseText}>Nearest available professionals are contacted first. You stay in control and can cancel while searching.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <FormStep number="1" title="What trade do you need?">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(['Plumber', 'Electrician', 'Builder', 'Heating', 'Locksmith', 'Carpenter', 'Roofer'] as TradeCategory[]).map(item => (
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

          <FormStep number="3" title="When do you need help?">
            <View style={styles.urgencyRow}>
              {[
                ['ASAP', 'Closest available now', 'bolt.fill', 'bolt'],
                ['Today', 'Same day', 'clock.fill', 'schedule'],
                ['This week', 'Flexible', 'calendar', 'calendar_today'],
              ].map(([name, sub, ios, android]) => (
                <Pressable
                  key={name}
                  style={[styles.urgencyCard, urgency === name && styles.urgencyCardActive]}
                  onPress={() => setUrgency(name)}
                >
                  <AppIcon icon={{ ios, android }} size={19} color={urgency === name ? '#087A4E' : C.navy2} />
                  <Text style={[styles.urgencyName, urgency === name && { color: '#087A4E' }]}>{name}</Text>
                  <Text style={styles.urgencySub}>{sub}</Text>
                </Pressable>
              ))}
            </View>
          </FormStep>

          <FormStep number="4" title="Add a photo (optional)">
            <View style={styles.photoRow}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoPicked} />
              ) : (
                <View style={styles.photoDemo}>
                  <AppIcon icon={{ ios: 'camera.fill', android: 'photo_camera' }} size={30} color={C.navy2} />
                </View>
              )}
              <Pressable style={styles.addPhoto} onPress={choosePhoto}>
                <Text style={styles.plus}>{photoUri ? '↻' : '＋'}</Text>
                <Text style={styles.addPhotoText}>{photoUri ? 'Change photo' : 'Add photo'}</Text>
              </Pressable>
            </View>
          </FormStep>

          <FormStep number="5" title="Confirm the job location">
            <Pressable style={styles.locationField} onPress={resolveCurrentLocation} disabled={locating}>
              <AppIcon icon={{ ios: 'location.fill', android: 'my_location' }} size={18} color={jobLocation ? C.green : C.blue} />
              <View style={{ flex: 1 }}>
                <Text style={styles.locationFieldText}>
                  {locating ? 'Finding your location…' : jobLocation ? 'Current location confirmed' : 'Use my current location'}
                </Text>
                <Text style={styles.locationPrivacyText}>
                  Only tradespeople offered this urgent job can see the exact location.
                </Text>
              </View>
              <Text style={{ color: jobLocation ? C.green : C.muted }}>{jobLocation ? '✓' : '›'}</Text>
            </Pressable>
          </FormStep>

          {demoCalloutRange ? (
            <View style={styles.dispatchEstimate}>
              <View>
                <Text style={styles.dispatchEstimateLabel}>Typical test call-out range</Text>
                <Text style={styles.dispatchEstimatePrice}>£{demoCalloutRange.min}–£{demoCalloutRange.max}</Text>
              </View>
              <Text style={styles.dispatchEstimateNote}>Final price agreed before work starts</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.findButton, submitting && { opacity: 0.65 }]}
            onPress={find}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <Text style={styles.findButtonText}>Find someone now →</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </CustomerShell>
  );
}

function BookingScreen({ trade, back, complete }: { trade: Trade; back: () => void; complete: () => void }) {
  const [service, setService] = useState(trade.services[0]);
  const dates = ['Today', 'Tomorrow', 'This weekend'];
  const times = ['08:00–10:00', '10:00–12:00', '14:00–16:00', 'Flexible'];
  const [dateIndex, setDateIndex] = useState(1);
  const [timeIndex, setTimeIndex] = useState(1);

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
          <Pressable
            style={styles.pickCard}
            onPress={() => setDateIndex(index => (index + 1) % dates.length)}
          >
            <Text style={styles.pickLabel}>Date</Text>
            <Text style={styles.pickValue}>{dates[dateIndex]}</Text>
            <Text style={styles.pickHint}>Tap to change</Text>
          </Pressable>
          <Pressable
            style={styles.pickCard}
            onPress={() => setTimeIndex(index => (index + 1) % times.length)}
          >
            <Text style={styles.pickLabel}>Time</Text>
            <Text style={styles.pickValue}>{times[timeIndex]}</Text>
            <Text style={styles.pickHint}>Tap to change</Text>
          </Pressable>
        </View>

        <Pressable style={styles.largeBlueButton} onPress={complete}><Text style={styles.largeBlueText}>Send booking request</Text></Pressable>
      </ScrollView>
    </CustomerShell>
  );
}

function RequestsScreen({
  requests,
  navigate,
}: {
  requests: RequestItem[];
  navigate: (screen: CustomerScreen) => void;
}) {
  const [liveRequests, setLiveRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLiveRequests = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('urgent_requests')
      .select('id, trade, issue, urgency, status, created_at')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    setLiveRequests(
      (data ?? []).map(row => ({
        id: row.id,
        trade: row.trade,
        issue: row.issue,
        urgency: row.urgency,
        status: dispatchStatusLabel(row.status),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    let channel: any = null;

    const start = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      await loadLiveRequests();

      channel = supabase
        .channel('customer-urgent-requests-' + user.id)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'urgent_requests',
            filter: 'customer_id=eq.' + user.id,
          },
          loadLiveRequests
        )
        .subscribe();
    };

    start();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const combined = [
    ...liveRequests,
    ...requests.filter(local => !liveRequests.some(live => live.id === local.id)),
  ];

  return (
    <CustomerShell current="requests" navigate={navigate}>
      <ScrollView contentContainerStyle={[styles.plainPage, { paddingBottom: 100 }]}>
        <Text style={styles.pageTitle}>Your requests</Text>
        <Text style={styles.pageSub}>Urgent searches and scheduled bookings.</Text>

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={C.blue} />
            <Text style={styles.emptyBody}>Loading your requests…</Text>
          </View>
        ) : combined.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>◷</Text>
            <Text style={styles.emptyTitle}>No requests yet</Text>
            <Text style={styles.emptyBody}>When you request or book a tradesperson, it will appear here.</Text>
            <Pressable style={styles.largeBlueButton} onPress={() => navigate('urgent')}>
              <Text style={styles.largeBlueText}>Need someone now?</Text>
            </Pressable>
          </View>
        ) : (
          combined.map(item => (
            <View key={item.id} style={styles.requestCard}>
              <View style={styles.requestTop}>
                <Text style={styles.requestTrade}>{item.trade}</Text>
                <Badge
                  text={item.status}
                  green={['Matched', 'On the way', 'Arrived', 'Completed', 'Booked'].includes(item.status)}
                  blue={item.status === 'Searching'}
                />
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

function MessagesScreen({ navigate }: { navigate: (screen: CustomerScreen) => void }) {
  type InboxConversation = {
    id: string;
    tradespersonId: string;
    name: string;
    trade: string;
    avatar: string | null;
    lastMessage: string;
    updatedAt: string;
  };

  type LiveMessage = {
    id: number;
    sender_id: string;
    body: string;
    created_at: string;
  };

  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<InboxConversation | null>(null);
  const [thread, setThread] = useState<LiveMessage[]>([]);
  const [message, setMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);

  const loadInbox = async () => {
    setLoadingInbox(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoadingInbox(false);
      return;
    }

    setCurrentUserId(user.id);

    const { data: rows, error } = await supabase
      .from('conversations')
      .select('id, tradesperson_id, updated_at')
      .eq('customer_id', user.id)
      .order('updated_at', { ascending: false });

    if (error || !rows?.length) {
      setConversations([]);
      setLoadingInbox(false);
      return;
    }

    const tradeIds = Array.from(new Set(rows.map(row => row.tradesperson_id)));
    const conversationIds = rows.map(row => row.id);

    const [{ data: profiles }, { data: latestMessages }] = await Promise.all([
      supabase
        .from('tradesperson_profiles')
        .select('user_id, display_name, primary_trade, avatar_url')
        .in('user_id', tradeIds),
      supabase
        .from('messages')
        .select('conversation_id, body, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false }),
    ]);

    const profileMap = new Map((profiles ?? []).map(profile => [profile.user_id, profile]));
    const latestByConversation = new Map<string, { body: string; created_at: string }>();

    for (const item of latestMessages ?? []) {
      if (!latestByConversation.has(item.conversation_id)) {
        latestByConversation.set(item.conversation_id, item);
      }
    }

    setConversations(
      rows.map(row => {
        const profile = profileMap.get(row.tradesperson_id);
        const latest = latestByConversation.get(row.id);

        return {
          id: row.id,
          tradespersonId: row.tradesperson_id,
          name: profile?.display_name || 'Tradesperson',
          trade: profile?.primary_trade || 'Trade professional',
          avatar: profile?.avatar_url || null,
          lastMessage: latest?.body || 'Conversation started',
          updatedAt: latest?.created_at || row.updated_at,
        };
      })
    );

    setLoadingInbox(false);
  };

  useEffect(() => {
    loadInbox();
  }, []);

  useEffect(() => {
    if (!selectedConversation) {
      setThread([]);
      return;
    }

    let active = true;
    setLoadingThread(true);

    supabase
      .from('messages')
      .select('id, sender_id, body, created_at')
      .eq('conversation_id', selectedConversation.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        setThread((data as LiveMessage[]) ?? []);
        setLoadingThread(false);
      });

    return () => {
      active = false;
    };
  }, [selectedConversation?.id]);

  const sendMessage = async () => {
    const body = message.trim();
    if (!body || !selectedConversation || !currentUserId) return;

    setMessage('');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedConversation.id,
        sender_id: currentUserId,
        body,
      })
      .select('id, sender_id, body, created_at')
      .single();

    if (error || !data) {
      setMessage(body);
      return;
    }

    setThread(prev => [...prev, data as LiveMessage]);

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', selectedConversation.id);

    loadInbox();
  };

  if (selectedConversation) {
    return (
      <CustomerShell current="messages" navigate={navigate}>
        <View style={styles.liveChatHeader}>
          <Pressable style={styles.liveChatBack} onPress={() => setSelectedConversation(null)}>
            <AppIcon icon={{ ios: 'chevron.left', android: 'arrow_back' }} size={20} color={C.navy2} />
          </Pressable>
          {selectedConversation.avatar ? (
            <Image source={{ uri: selectedConversation.avatar }} style={styles.liveChatAvatar} />
          ) : (
            <View style={styles.liveChatAvatarFallback}>
              <Text style={styles.liveChatAvatarText}>{selectedConversation.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.liveChatName}>{selectedConversation.name}</Text>
            <Text style={styles.liveChatRole}>{selectedConversation.trade}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.liveChatBody}
          contentContainerStyle={styles.liveChatContent}
          showsVerticalScrollIndicator={false}
        >
          {loadingThread ? (
            <Text style={styles.messagesMuted}>Loading conversation…</Text>
          ) : thread.length ? (
            thread.map(item => {
              const mine = item.sender_id === currentUserId;
              return (
                <View key={item.id} style={[styles.liveBubble, mine ? styles.liveBubbleMine : styles.liveBubbleTheirs]}>
                  <Text style={[styles.liveBubbleText, mine && styles.liveBubbleTextMine]}>{item.body}</Text>
                </View>
              );
            })
          ) : (
            <View style={styles.threadEmpty}>
              <Text style={styles.threadEmptyTitle}>Start the conversation</Text>
              <Text style={styles.threadEmptySub}>Send a message about the job you need doing.</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.liveComposer}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            style={styles.liveComposerInput}
            placeholder="Type a message…"
            placeholderTextColor="#9AA6B3"
            multiline
          />
          <Pressable
            style={[styles.liveSendButton, !message.trim() && styles.liveSendButtonDisabled]}
            onPress={sendMessage}
            disabled={!message.trim()}
          >
            <AppIcon icon={{ ios: 'arrow.up', android: 'arrow_upward' }} size={19} color={C.white} />
          </Pressable>
        </View>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell current="messages" navigate={navigate}>
      <View style={styles.messagesPage}>
        <View style={styles.messagesTitleRow}>
          <View>
            <Text style={styles.messagesTitle}>Messages</Text>
            <Text style={styles.messagesSub}>Your conversations with tradespeople.</Text>
          </View>
        </View>

        {loadingInbox ? (
          <View style={styles.messagesLoading}>
            <Text style={styles.messagesMuted}>Loading messages…</Text>
          </View>
        ) : conversations.length ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {conversations.map(item => (
              <Pressable
                key={item.id}
                style={styles.inboxRow}
                onPress={() => setSelectedConversation(item)}
              >
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.inboxAvatar} />
                ) : (
                  <View style={styles.inboxAvatarFallback}>
                    <Text style={styles.inboxAvatarFallbackText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.inboxMain}>
                  <View style={styles.inboxNameRow}>
                    <Text style={styles.inboxName}>{item.name}</Text>
                    <Text style={styles.inboxTime}>
                      {new Date(item.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <Text style={styles.inboxTrade}>{item.trade}</Text>
                  <Text style={styles.inboxLast} numberOfLines={1}>{item.lastMessage}</Text>
                </View>
                <AppIcon icon={{ ios: 'chevron.right', android: 'chevron_right' }} size={18} color="#A5AFBA" />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.messagesEmpty}>
            <View style={styles.messagesEmptyIcon}>
              <AppIcon icon={{ ios: 'message.fill', android: 'chat_bubble' }} size={30} color={C.blue} />
            </View>
            <Text style={styles.messagesEmptyTitle}>No messages yet</Text>
            <Text style={styles.messagesEmptySub}>
              When you contact a tradesperson, the conversation will appear here.
            </Text>
            <Pressable style={styles.messagesBrowseButton} onPress={() => navigate('map')}>
              <Text style={styles.messagesBrowseText}>Find a tradesperson</Text>
            </Pressable>
          </View>
        )}
      </View>
    </CustomerShell>
  );
}

function CustomerProfileScreen({
  navigate,
  switchToTrade,
  signOut,
  accountType,
}: {
  navigate: (screen: CustomerScreen) => void;
  switchToTrade: () => void;
  signOut: () => void;
  accountType: 'customer' | 'tradesperson';
}) {
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    default_address: '',
    notifications_enabled: true,
  });
  const [editMode, setEditMode] = useState<'details' | 'address' | 'notifications' | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone, default_address, notifications_enabled')
      .eq('id', user.id)
      .single();

    if (data) {
      setProfile({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || '',
        default_address: data.default_address || '',
        notifications_enabled: data.notifications_enabled !== false,
      });
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        phone: profile.phone.trim(),
        default_address: profile.default_address.trim() || null,
        notifications_enabled: profile.notifications_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }

    setEditMode(null);
  };

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Your account';
  const initial = (profile.first_name || profile.last_name || 'T').charAt(0).toUpperCase();

  return (
    <CustomerShell current="customerProfile" navigate={navigate}>
      <ScrollView contentContainerStyle={[styles.plainPage, { paddingBottom: 100 }]}>
        <Text style={styles.pageTitle}>Profile</Text>

        <View style={styles.customerProfileCard}>
          <View style={styles.customerAvatar}><Text style={styles.customerAvatarText}>{initial}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>{fullName}</Text>
            <Text style={styles.muted}>{accountType === 'tradesperson' ? 'Tradesperson account' : 'Customer account'}</Text>
          </View>
        </View>

        <Pressable style={styles.settingsRow} onPress={() => setEditMode('details')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingsLabel}>Personal details</Text>
            <Text style={styles.settingsSubText}>{profile.phone || 'Add your phone number'}</Text>
          </View>
          <Text style={styles.settingsChevron}>›</Text>
        </Pressable>

        <Pressable
          style={styles.settingsRow}
          onPress={() => Alert.alert('Saved tradespeople', 'You have not saved any tradespeople yet.')}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.settingsLabel}>Saved tradespeople</Text>
            <Text style={styles.settingsSubText}>Your favourites will appear here</Text>
          </View>
          <Text style={styles.settingsChevron}>›</Text>
        </Pressable>

        <Pressable style={styles.settingsRow} onPress={() => setEditMode('address')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingsLabel}>Address</Text>
            <Text style={styles.settingsSubText} numberOfLines={1}>
              {profile.default_address || 'Add your default job address'}
            </Text>
          </View>
          <Text style={styles.settingsChevron}>›</Text>
        </Pressable>

        <Pressable style={styles.settingsRow} onPress={() => setEditMode('notifications')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingsLabel}>Notifications</Text>
            <Text style={styles.settingsSubText}>{profile.notifications_enabled ? 'On' : 'Off'}</Text>
          </View>
          <Text style={styles.settingsChevron}>›</Text>
        </Pressable>

        <Pressable
          style={styles.settingsRow}
          onPress={() => Alert.alert('Help & support', 'Support chat and help articles will be added before public launch.')}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.settingsLabel}>Help & support</Text>
            <Text style={styles.settingsSubText}>Get help with TradeHub</Text>
          </View>
          <Text style={styles.settingsChevron}>›</Text>
        </Pressable>

        {accountType === 'tradesperson' ? (
          <Pressable style={styles.proSwitchCard} onPress={switchToTrade}>
            <View style={{ flex: 1 }}>
              <Text style={styles.proSwitchTitle}>Open TradeHub Pro</Text>
              <Text style={styles.proSwitchSub}>Manage availability, work area and incoming jobs.</Text>
            </View>
            <Text style={styles.proSwitchArrow}>→</Text>
          </Pressable>
        ) : (
          <View style={styles.proSwitchCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.proSwitchTitle}>Tradesperson accounts</Text>
              <Text style={styles.proSwitchSub}>Create a tradesperson account to appear on the map and receive jobs.</Text>
            </View>
          </View>
        )}

        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={editMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditMode(null)}
      >
        <View style={styles.profileModalRoot}>
          <Pressable style={styles.profileModalBackdrop} onPress={() => setEditMode(null)} />
          <View style={styles.profileModalSheet}>
            <View style={styles.filterSheetHandle} />

            {editMode === 'details' ? (
              <>
                <Text style={styles.profileModalTitle}>Personal details</Text>
                <Text style={styles.profileFieldLabel}>First name</Text>
                <TextInput
                  style={styles.profileField}
                  value={profile.first_name}
                  onChangeText={value => setProfile(current => ({ ...current, first_name: value }))}
                  autoCapitalize="words"
                />
                <Text style={styles.profileFieldLabel}>Last name</Text>
                <TextInput
                  style={styles.profileField}
                  value={profile.last_name}
                  onChangeText={value => setProfile(current => ({ ...current, last_name: value }))}
                  autoCapitalize="words"
                />
                <Text style={styles.profileFieldLabel}>Mobile number</Text>
                <TextInput
                  style={styles.profileField}
                  value={profile.phone}
                  onChangeText={value => setProfile(current => ({ ...current, phone: value.replace(/\D/g, '').slice(0, 11) }))}
                  keyboardType="phone-pad"
                />
              </>
            ) : null}

            {editMode === 'address' ? (
              <>
                <Text style={styles.profileModalTitle}>Default address</Text>
                <Text style={styles.profileModalHint}>Used to pre-fill job requests. You can change it for each job.</Text>
                <TextInput
                  style={[styles.profileField, styles.profileAddressField]}
                  value={profile.default_address}
                  onChangeText={value => setProfile(current => ({ ...current, default_address: value }))}
                  placeholder="House number, street, town, postcode"
                  placeholderTextColor="#98A4B2"
                  multiline
                />
              </>
            ) : null}

            {editMode === 'notifications' ? (
              <>
                <Text style={styles.profileModalTitle}>Notifications</Text>
                <View style={styles.notificationSettingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsLabel}>TradeHub notifications</Text>
                    <Text style={styles.settingsSubText}>Messages, booking updates and job responses</Text>
                  </View>
                  <Switch
                    value={profile.notifications_enabled}
                    onValueChange={value => setProfile(current => ({ ...current, notifications_enabled: value }))}
                  />
                </View>
              </>
            ) : null}

            <Pressable style={[styles.largeBlueButton, saving && { opacity: 0.5 }]} onPress={saveProfile} disabled={saving}>
              <Text style={styles.largeBlueText}>{saving ? 'Saving…' : 'Save changes'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  const [available, setAvailable] = useState(false);
  const [duration, setDuration] = useState('2 hours');
  const [radius, setRadius] = useState(10);
  const [firstName, setFirstName] = useState('there');
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [locationMode, setLocationMode] = useState<'work_area' | 'live'>('work_area');

  useEffect(() => {
    let active = true;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !active) return;

      const [{ data: person }, { data: availability }] = await Promise.all([
        supabase.from('profiles').select('first_name').eq('id', user.id).single(),
        supabase
          .from('trade_availability')
          .select('is_available, radius_miles, available_until, location_mode')
          .eq('user_id', user.id)
          .single(),
      ]);

      if (!active) return;

      if (person?.first_name) setFirstName(person.first_name);
      if (availability) {
        setAvailable(Boolean(availability.is_available));
        setRadius(Number(availability.radius_miles) || 10);
        setLocationMode(availability.location_mode === 'live' ? 'live' : 'work_area');
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!available || locationMode !== 'live') return;

    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted' || !active) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !active) return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 30,
          timeInterval: 10000,
        },
        async position => {
          if (!active) return;

          const exactLatitude = position.coords.latitude;
          const exactLongitude = position.coords.longitude;
          const publicLatitude = Number(exactLatitude.toFixed(3));
          const publicLongitude = Number(exactLongitude.toFixed(3));
          const now = new Date().toISOString();

          await Promise.all([
            supabase.from('trade_locations').upsert({
              user_id: user.id,
              latitude: exactLatitude,
              longitude: exactLongitude,
              accuracy_meters: position.coords.accuracy,
              updated_at: now,
            }),
            supabase.from('trade_map_presence').upsert({
              user_id: user.id,
              latitude: publicLatitude,
              longitude: publicLongitude,
              source_mode: 'live',
              updated_at: now,
            }),
          ]);
        }
      );
    };

    startTracking();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [available, locationMode]);

  const durationToUntil = (value: string) => {
    const now = new Date();
    if (value === '1 hour') return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    if (value === '2 hours') return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    if (value === '4 hours') return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
  };

  const saveAvailability = async (nextAvailable: boolean, nextDuration = duration, nextRadius = radius) => {
    setSavingAvailability(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSavingAvailability(false);
      return;
    }

    const { error } = await supabase
      .from('trade_availability')
      .update({
        is_available: nextAvailable,
        radius_miles: nextRadius,
        available_until: nextAvailable ? durationToUntil(nextDuration) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    setSavingAvailability(false);

    if (error) {
      Alert.alert('Could not update availability', error.message);
    }
  };

  const changeAvailable = async (value: boolean) => {
    setAvailable(value);
    await saveAvailability(value);
  };

  const changeDuration = async (value: string) => {
    setDuration(value);
    if (available) await saveAvailability(true, value, radius);
  };

  const changeRadius = async (value: number) => {
    setRadius(value);
    await saveAvailability(available, duration, value);
  };

  return (
    <TradeShell current="tradeHome" navigate={navigate}>
      <ScrollView contentContainerStyle={styles.tradePage}>
        <View style={styles.tradeHeaderRow}>
          <View>
            <Text style={styles.tradeBrand}>TradeHub <Text style={{ color: C.cyan }}>Pro</Text></Text>
            <Text style={styles.tradeHello}>Hi {firstName}</Text>
          </View>
          <Pressable style={styles.customerMini} onPress={switchToCustomer}>
            <Text style={styles.customerMiniText}>Customer app</Text>
          </Pressable>
        </View>

        <View style={styles.availablePanel}>
          <View style={{ flex: 1 }}>
            <Text style={styles.availablePanelTitle}>{available ? 'Available now' : 'Go available'}</Text>
            <Text style={styles.availablePanelSub}>
              {savingAvailability
                ? 'Saving…'
                : available
                  ? "You're visible to nearby customers"
                  : "You're hidden from new nearby searches"}
            </Text>
          </View>
          <Switch value={available} onValueChange={changeAvailable} trackColor={{ true: C.green }} disabled={savingAvailability} />
        </View>

        <Text style={styles.tradeLabel}>Availability duration</Text>
        <View style={styles.tradeChipWrap}>
          {['1 hour', '2 hours', '4 hours', 'All day'].map(item => (
            <Pressable
              key={item}
              style={[styles.tradeChip, duration === item && styles.tradeChipActive]}
              onPress={() => changeDuration(item)}
            >
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
            <Pressable
              key={value}
              onPress={() => changeRadius(value)}
              style={[styles.radiusDot, radius === value && styles.radiusDotActive]}
            >
              <Text style={[styles.radiusDotText, radius === value && { color: C.white }]}>{value}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.tradeStats}>
          <TradeStat number="—" label="Profile views" />
          <TradeStat number="—" label="Messages" />
          <TradeStat number="—" label="Bookings" />
        </View>

        <View style={styles.tradeSectionHeader}>
          <Text style={styles.tradeSectionTitle}>Nearby opportunities</Text>
          <Pressable onPress={() => navigate('tradeJobs')}><Text style={styles.tradeLink}>View all</Text></Pressable>
        </View>

        <View style={styles.tradeEmptyCard}>
          <Text style={styles.tradeEmptyTitle}>No live opportunities yet</Text>
          <Text style={styles.tradeEmptyText}>New customer requests matching your trade and travel radius will appear here.</Text>
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>
    </TradeShell>
  );
}

function TradeJobsScreen({
  navigate,
}: {
  screen: TradeScreen;
  navigate: (screen: TradeScreen) => void;
  switchToCustomer: () => void;
}) {
  type OfferJob = {
    offerId: string;
    offerStatus: string;
    distance: number;
    eta: number;
    request: any;
  };

  const [jobs, setJobs] = useState<OfferJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadJobs = async (knownUserId?: string) => {
    setLoading(true);

    const userId =
      knownUserId ||
      (
        await supabase.auth.getUser()
      ).data.user?.id ||
      null;

    if (!userId) {
      setJobs([]);
      setLoading(false);
      return;
    }

    setCurrentUserId(userId);

    const { data: offerRows, error: offerError } = await supabase
      .from('urgent_request_offers')
      .select('id, request_id, status, distance_miles, eta_minutes, offered_at')
      .eq('tradesperson_id', userId)
      .in('status', ['offered', 'accepted'])
      .order('offered_at', { ascending: false });

    if (offerError || !offerRows?.length) {
      setJobs([]);
      setLoading(false);
      return;
    }

    const requestIds = Array.from(new Set(offerRows.map(row => row.request_id)));

    const { data: requestRows } = await supabase
      .from('urgent_requests')
      .select(
        'id, trade, issue, urgency, latitude, longitude, status, customer_id, created_at, accepted_tradesperson_id, estimated_arrival_minutes'
      )
      .in('id', requestIds);

    const requestMap = new Map((requestRows ?? []).map(row => [row.id, row]));

    setJobs(
      offerRows
        .map(row => ({
          offerId: row.id,
          offerStatus: row.status,
          distance: Number(row.distance_miles),
          eta: Number(row.eta_minutes),
          request: requestMap.get(row.request_id),
        }))
        .filter(item => item.request)
    );

    setLoading(false);
  };

  useEffect(() => {
    let offerChannel: any = null;
    let requestChannel: any = null;
    let mounted = true;

    const start = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) {
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);
      await loadJobs(user.id);

      offerChannel = supabase
        .channel('urgent-offers-' + user.id)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'urgent_request_offers',
            filter: 'tradesperson_id=eq.' + user.id,
          },
          () => loadJobs(user.id)
        )
        .subscribe();

      requestChannel = supabase
        .channel('urgent-jobs-' + user.id)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'urgent_requests',
            filter: 'accepted_tradesperson_id=eq.' + user.id,
          },
          () => loadJobs(user.id)
        )
        .subscribe();
    };

    start();

    return () => {
      mounted = false;
      if (offerChannel) supabase.removeChannel(offerChannel);
      if (requestChannel) supabase.removeChannel(requestChannel);
    };
  }, []);

  const respondToOffer = async (job: OfferJob, response: 'accepted' | 'declined') => {
    setBusyId(job.offerId);

    const { error } = await supabase
      .from('urgent_request_offers')
      .update({
        status: response,
        responded_at: new Date().toISOString(),
      })
      .eq('id', job.offerId)
      .eq('status', 'offered');

    setBusyId(null);

    if (error) {
      Alert.alert(
        response === 'accepted' ? 'Job no longer available' : 'Could not decline',
        response === 'accepted'
          ? 'Another tradesperson may have accepted this job first.'
          : error.message
      );
      await loadJobs(currentUserId || undefined);
      return;
    }

    await loadJobs(currentUserId || undefined);
  };

  const advanceJob = async (job: OfferJob) => {
    const current = job.request.status;
    const next =
      current === 'matched'
        ? 'en_route'
        : current === 'en_route'
          ? 'arrived'
          : current === 'arrived'
            ? 'completed'
            : null;

    if (!next) return;

    setBusyId(job.offerId);
    const { error } = await supabase
      .from('urgent_requests')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', job.request.id);

    setBusyId(null);

    if (error) {
      Alert.alert('Could not update job', error.message);
      return;
    }

    await loadJobs(currentUserId || undefined);
  };

  const openDirections = (job: OfferJob) => {
    const lat = job.request.latitude;
    const lng = job.request.longitude;
    Linking.openURL('https://maps.google.com/?daddr=' + lat + ',' + lng);
  };

  const active = jobs.filter(job => job.offerStatus === 'accepted');
  const offered = jobs.filter(job => job.offerStatus === 'offered');

  return (
    <TradeShell current="tradeJobs" navigate={navigate}>
      <ScrollView contentContainerStyle={styles.tradePage} showsVerticalScrollIndicator={false}>
        <Text style={styles.tradePageTitle}>Jobs nearby</Text>
        <Text style={styles.tradePageSub}>
          Urgent requests are offered to nearby available tradespeople. The first suitable professional to accept gets the job.
        </Text>

        {active.length ? (
          <>
            <Text style={styles.dispatchTradeSectionTitle}>Active job</Text>
            {active.map(job => (
              <View key={job.offerId} style={styles.dispatchTradeActiveCard}>
                <View style={styles.dispatchTradeTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dispatchTradeUrgency}>{job.request.urgency} request</Text>
                    <Text style={styles.dispatchTradeJobTitle}>{job.request.trade}</Text>
                  </View>
                  <Badge text={dispatchStatusLabel(job.request.status)} green />
                </View>

                <Text style={styles.dispatchTradeIssue}>{job.request.issue}</Text>

                <View style={styles.dispatchTradeMetaRow}>
                  <Text style={styles.dispatchTradeMeta}>📍 {job.distance.toFixed(1)} mi away</Text>
                  <Text style={styles.dispatchTradeMeta}>~{job.eta} min ETA</Text>
                </View>

                <View style={styles.dispatchTradeActionRow}>
                  <Pressable style={styles.dispatchTradeDirections} onPress={() => openDirections(job)}>
                    <AppIcon icon={{ ios: 'map.fill', android: 'map' }} size={17} color={C.navy2} />
                    <Text style={styles.dispatchTradeDirectionsText}>Directions</Text>
                  </Pressable>

                  {job.request.status !== 'completed' ? (
                    <Pressable
                      style={[styles.dispatchTradeAdvance, busyId === job.offerId && { opacity: 0.6 }]}
                      onPress={() => advanceJob(job)}
                      disabled={busyId === job.offerId}
                    >
                      <Text style={styles.dispatchTradeAdvanceText}>
                        {job.request.status === 'matched'
                          ? 'Start journey'
                          : job.request.status === 'en_route'
                            ? "I've arrived"
                            : job.request.status === 'arrived'
                              ? 'Complete job'
                              : 'Update'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.dispatchTradeSectionTitle}>New urgent offers</Text>

        {loading ? (
          <View style={styles.tradeEmptyLarge}>
            <ActivityIndicator color={C.cyan} />
            <Text style={styles.tradeEmptyLargeText}>Checking for nearby requests…</Text>
          </View>
        ) : offered.length ? (
          offered.map(job => (
            <View key={job.offerId} style={styles.dispatchTradeOfferCard}>
              <View style={styles.dispatchTradeTopRow}>
                <View style={styles.dispatchTradeUrgentIcon}>
                  <AppIcon icon={{ ios: 'bolt.fill', android: 'bolt' }} size={18} color={C.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dispatchTradeUrgency}>Urgent · {job.request.urgency}</Text>
                  <Text style={styles.dispatchTradeJobTitle}>{job.request.trade}</Text>
                </View>
                <View style={styles.dispatchTradeEtaPill}>
                  <Text style={styles.dispatchTradeEtaValue}>~{job.eta} min</Text>
                  <Text style={styles.dispatchTradeEtaSmall}>estimated</Text>
                </View>
              </View>

              <Text style={styles.dispatchTradeIssue}>{job.request.issue}</Text>

              <View style={styles.dispatchTradeMetaRow}>
                <Text style={styles.dispatchTradeMeta}>📍 {job.distance.toFixed(1)} mi away</Text>
                <Text style={styles.dispatchTradeMeta}>Location shown after acceptance</Text>
              </View>

              <View style={styles.dispatchTradeDecisionRow}>
                <Pressable
                  style={styles.dispatchTradeDecline}
                  onPress={() => respondToOffer(job, 'declined')}
                  disabled={busyId === job.offerId}
                >
                  <Text style={styles.dispatchTradeDeclineText}>Decline</Text>
                </Pressable>
                <Pressable
                  style={[styles.dispatchTradeAccept, busyId === job.offerId && { opacity: 0.6 }]}
                  onPress={() => respondToOffer(job, 'accepted')}
                  disabled={busyId === job.offerId}
                >
                  {busyId === job.offerId ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <Text style={styles.dispatchTradeAcceptText}>Accept job</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.tradeEmptyLarge}>
            <AppIcon icon={{ ios: 'bolt.fill', android: 'bolt' }} size={30} color={C.cyan} />
            <Text style={styles.tradeEmptyLargeTitle}>No urgent offers right now</Text>
            <Text style={styles.tradeEmptyLargeText}>
              Keep your availability on. Matching requests inside your travel radius will appear here automatically.
            </Text>
          </View>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>
    </TradeShell>
  );
}

function TradeMapScreen({ navigate }: { screen: TradeScreen; navigate: (screen: TradeScreen) => void; switchToCustomer: () => void }) {
  return (
    <TradeShell current="tradeMap" navigate={navigate}>
      <View style={styles.tradeMapStatus}>
        <Text style={styles.tradeMapStatusTitle}>Your work map</Text>
        <Text style={styles.tradeMapStatusSub}>Use Profile → Map location to choose your work area or live-location mode.</Text>
      </View>
      <View style={{ flex: 1, paddingBottom: 90 }}>
        <MapMock trades={[]} onTrade={() => {}} />
      </View>
    </TradeShell>
  );
}

function TradeMessagesScreen({ navigate }: { screen: TradeScreen; navigate: (screen: TradeScreen) => void; switchToCustomer: () => void }) {
  type TradeConversation = {
    id: string;
    customerId: string;
    customerName: string;
    lastMessage: string;
    updatedAt: string;
  };

  type TradeLiveMessage = {
    id: number;
    sender_id: string;
    body: string;
    created_at: string;
  };

  const [conversations, setConversations] = useState<TradeConversation[]>([]);
  const [selected, setSelected] = useState<TradeConversation | null>(null);
  const [thread, setThread] = useState<TradeLiveMessage[]>([]);
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadInbox = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: rows } = await supabase
      .from('conversations')
      .select('id, customer_id, updated_at')
      .eq('tradesperson_id', user.id)
      .order('updated_at', { ascending: false });

    if (!rows?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const customerIds = Array.from(new Set(rows.map(row => row.customer_id)));
    const conversationIds = rows.map(row => row.id);

    const [{ data: customers }, { data: latestMessages }] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name').in('id', customerIds),
      supabase
        .from('messages')
        .select('conversation_id, body, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false }),
    ]);

    const customerMap = new Map((customers ?? []).map(person => [person.id, person]));
    const latestMap = new Map<string, { body: string; created_at: string }>();

    for (const item of latestMessages ?? []) {
      if (!latestMap.has(item.conversation_id)) latestMap.set(item.conversation_id, item);
    }

    setConversations(
      rows.map(row => {
        const person = customerMap.get(row.customer_id);
        const latest = latestMap.get(row.id);
        const name = [person?.first_name, person?.last_name].filter(Boolean).join(' ') || 'Customer';
        return {
          id: row.id,
          customerId: row.customer_id,
          customerName: name,
          lastMessage: latest?.body || 'Conversation started',
          updatedAt: latest?.created_at || row.updated_at,
        };
      })
    );

    setLoading(false);
  };

  useEffect(() => {
    loadInbox();
  }, []);

  useEffect(() => {
    if (!selected) {
      setThread([]);
      return;
    }

    supabase
      .from('messages')
      .select('id, sender_id, body, created_at')
      .eq('conversation_id', selected.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setThread((data as TradeLiveMessage[]) ?? []));
  }, [selected?.id]);

  const send = async () => {
    const body = message.trim();
    if (!body || !selected || !userId) return;

    setMessage('');

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: selected.id, sender_id: userId, body })
      .select('id, sender_id, body, created_at')
      .single();

    if (error || !data) {
      setMessage(body);
      Alert.alert('Could not send message', error?.message || 'Try again.');
      return;
    }

    setThread(current => [...current, data as TradeLiveMessage]);

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', selected.id);

    loadInbox();
  };

  if (selected) {
    return (
      <TradeShell current="tradeMessages" navigate={navigate}>
        <View style={styles.tradeChatHeader}>
          <Pressable onPress={() => setSelected(null)} style={styles.tradeChatBack}>
            <AppIcon icon={{ ios: 'chevron.left', android: 'arrow_back' }} size={19} color={C.white} />
          </Pressable>
          <View>
            <Text style={styles.tradeChatName}>{selected.customerName}</Text>
            <Text style={styles.tradeChatSub}>Customer conversation</Text>
          </View>
        </View>

        <ScrollView style={styles.tradeChatBody} contentContainerStyle={styles.tradeChatContent}>
          {thread.map(item => {
            const mine = item.sender_id === userId;
            return (
              <View key={item.id} style={[styles.tradeChatBubble, mine ? styles.tradeChatMine : styles.tradeChatTheirs]}>
                <Text style={[styles.tradeChatBubbleText, mine && { color: C.white }]}>{item.body}</Text>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.tradeChatComposer}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            style={styles.tradeChatInput}
            placeholder="Type a message…"
            placeholderTextColor="#7890A4"
          />
          <Pressable style={[styles.tradeChatSend, !message.trim() && { opacity: 0.35 }]} onPress={send} disabled={!message.trim()}>
            <AppIcon icon={{ ios: 'arrow.up', android: 'arrow_upward' }} size={18} color={C.white} />
          </Pressable>
        </View>
      </TradeShell>
    );
  }

  return (
    <TradeShell current="tradeMessages" navigate={navigate}>
      <ScrollView contentContainerStyle={styles.tradePage}>
        <Text style={styles.tradePageTitle}>Messages</Text>
        <Text style={styles.tradePageSub}>Real customer conversations will appear here.</Text>

        {loading ? (
          <Text style={styles.darkMessageLast}>Loading messages…</Text>
        ) : conversations.length ? (
          conversations.map(item => (
            <Pressable key={item.id} style={styles.darkMessageRow} onPress={() => setSelected(item)}>
              <View style={styles.darkAvatar}><Text style={styles.darkAvatarText}>{item.customerName.charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.darkMessageName}>{item.customerName}</Text>
                <Text style={styles.darkMessageLast} numberOfLines={1}>{item.lastMessage}</Text>
              </View>
              <AppIcon icon={{ ios: 'chevron.right', android: 'chevron_right' }} size={17} color="#7890A4" />
            </Pressable>
          ))
        ) : (
          <View style={styles.tradeEmptyLarge}>
            <AppIcon icon={{ ios: 'message.fill', android: 'chat_bubble' }} size={30} color={C.cyan} />
            <Text style={styles.tradeEmptyLargeTitle}>No messages yet</Text>
            <Text style={styles.tradeEmptyLargeText}>When a customer starts a conversation with your real profile, it will show here.</Text>
          </View>
        )}
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
  const [displayName, setDisplayName] = useState('Your trade profile');
  const [primaryTrade, setPrimaryTrade] = useState('Tradesperson');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<'work_area' | 'live'>('work_area');
  const [workAreaSaved, setWorkAreaSaved] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  useEffect(() => {
    let active = true;

    const loadTradeProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !active) return;

      const [{ data: profile }, { data: availability }] = await Promise.all([
        supabase
          .from('tradesperson_profiles')
          .select('display_name, primary_trade, avatar_url')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('trade_availability')
          .select('location_mode, work_area_latitude, work_area_longitude')
          .eq('user_id', user.id)
          .single(),
      ]);

      if (!active) return;

      if (profile) {
        setDisplayName(profile.display_name || 'Your trade profile');
        setPrimaryTrade(profile.primary_trade || 'Tradesperson');
        setAvatarUrl(profile.avatar_url || null);
      }

      if (availability) {
        setLocationMode(availability.location_mode === 'live' ? 'live' : 'work_area');
        setWorkAreaSaved(
          typeof availability.work_area_latitude === 'number' &&
          typeof availability.work_area_longitude === 'number'
        );
      }
    };

    loadTradeProfile();

    return () => {
      active = false;
    };
  }, []);

  const setModeOnly = async (mode: 'work_area' | 'live') => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setLocationMode(mode);

    await supabase
      .from('trade_availability')
      .update({
        location_mode: mode,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);
  };

  const saveCurrentPosition = async (mode: 'work_area' | 'live') => {
    setSavingLocation(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setSavingLocation(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSavingLocation(false);
        return;
      }

      const exactLatitude = position.coords.latitude;
      const exactLongitude = position.coords.longitude;

      // Public browsing uses a softened position. Exact GPS remains private.
      const publicLatitude = Number(exactLatitude.toFixed(mode === 'live' ? 3 : 2));
      const publicLongitude = Number(exactLongitude.toFixed(mode === 'live' ? 3 : 2));
      const now = new Date().toISOString();

      if (mode === 'live') {
        await supabase.from('trade_locations').upsert({
          user_id: user.id,
          latitude: exactLatitude,
          longitude: exactLongitude,
          accuracy_meters: position.coords.accuracy,
          updated_at: now,
        });

        await supabase
          .from('trade_availability')
          .update({
            location_mode: 'live',
            updated_at: now,
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('trade_availability')
          .update({
            location_mode: 'work_area',
            work_area_label: 'Saved work area',
            work_area_latitude: publicLatitude,
            work_area_longitude: publicLongitude,
            updated_at: now,
          })
          .eq('user_id', user.id);

        setWorkAreaSaved(true);
      }

      await supabase.from('trade_map_presence').upsert({
        user_id: user.id,
        latitude: publicLatitude,
        longitude: publicLongitude,
        source_mode: mode,
        updated_at: now,
      });

      setLocationMode(mode);
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <TradeShell current="tradeProfile" navigate={navigate}>
      <ScrollView contentContainerStyle={styles.tradePage}>
        <Text style={styles.tradePageTitle}>Trade profile</Text>

        <View style={styles.proProfile}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.proProfileImage} />
          ) : (
            <View style={styles.proProfileFallback}>
              <Text style={styles.proProfileFallbackText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.proName}>{displayName}</Text>
            <Text style={styles.proRole}>{primaryTrade}</Text>
            <Text style={styles.proVerify}>Profile linked to your TradeHub account</Text>
          </View>
        </View>

        <View style={styles.locationSettingsCard}>
          <View style={styles.locationSettingsHeader}>
            <View style={styles.locationSettingsIcon}>
              <AppIcon icon={{ ios: 'location.fill', android: 'location_on' }} size={20} color={C.cyan} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationSettingsTitle}>Map location</Text>
              <Text style={styles.locationSettingsSub}>Choose how customers discover where you work.</Text>
            </View>
          </View>

          <Pressable
            style={[styles.locationChoice, locationMode === 'work_area' && styles.locationChoiceActive]}
            onPress={() => setModeOnly('work_area')}
          >
            <View style={styles.locationChoiceRadio}>
              {locationMode === 'work_area' ? <View style={styles.locationChoiceRadioInner} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.locationChoiceTitleRow}>
                <Text style={styles.locationChoiceTitle}>Work area</Text>
                <View style={styles.recommendedPill}><Text style={styles.recommendedText}>Recommended</Text></View>
              </View>
              <Text style={styles.locationChoiceText}>
                Show customers a general area you work in instead of your exact position.
              </Text>
            </View>
          </Pressable>

          {locationMode === 'work_area' ? (
            <Pressable
              style={styles.locationSaveButton}
              onPress={() => saveCurrentPosition('work_area')}
              disabled={savingLocation}
            >
              <Text style={styles.locationSaveButtonText}>
                {savingLocation ? 'Saving…' : workAreaSaved ? 'Update my work area' : 'Set my current area as work area'}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.locationChoice, locationMode === 'live' && styles.locationChoiceActive, { marginTop: 10 }]}
            onPress={() => setModeOnly('live')}
          >
            <View style={styles.locationChoiceRadio}>
              {locationMode === 'live' ? <View style={styles.locationChoiceRadioInner} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationChoiceTitle}>Live location while available</Text>
              <Text style={styles.locationChoiceText}>
                Use your current position while you are available. Browsing customers still see a softened position; exact tracking can be shared after a job is accepted.
              </Text>
            </View>
          </Pressable>

          {locationMode === 'live' ? (
            <Pressable
              style={styles.locationSaveButton}
              onPress={() => saveCurrentPosition('live')}
              disabled={savingLocation}
            >
              <Text style={styles.locationSaveButtonText}>
                {savingLocation ? 'Updating…' : 'Update live position now'}
              </Text>
            </Pressable>
          ) : null}

          <Text style={styles.locationPrivacyNote}>
            Your exact GPS location is kept separate from the public map.
          </Text>
        </View>

        {['Business details', 'Services & prices', 'Verification', 'Availability defaults', 'Notifications', 'Payouts'].map(item => (
          <View key={item} style={styles.darkSettingsRow}>
            <Text style={styles.darkSettingsLabel}>{item}</Text>
            <Text style={styles.darkSettingsStatus}>Setup later</Text>
          </View>
        ))}

        <Pressable style={styles.backCustomerButton} onPress={switchToCustomer}>
          <Text style={styles.backCustomerText}>Switch to customer app</Text>
        </Pressable>
        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
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
  mapTop: { paddingHorizontal: 14, paddingTop: 10, backgroundColor: C.white, zIndex: 5, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  mapSearchRow: { flexDirection: 'row', alignItems: 'center' },
  mapSearch: { flex: 1, height: 48, borderRadius: 16, backgroundColor: '#F4F6F9', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  mapSearchText: { marginLeft: 9, color: C.muted, fontSize: 15 },
  mapSearchInput: { flex: 1, marginLeft: 9, color: C.text, fontSize: 15, paddingVertical: 0 },
  mapControlButton: { width: 48, height: 48, marginLeft: 8, borderRadius: 16, backgroundColor: '#F4F6F9', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  mapControlButtonActive: { backgroundColor: C.navy2 },
  filterBadge: { position: 'absolute', right: -3, top: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.blue, borderWidth: 2, borderColor: C.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterBadgeText: { color: C.white, fontSize: 9, fontWeight: '900' },
  chipRow: { paddingVertical: 10 },
  chip: { backgroundColor: '#F3F5F8', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, marginRight: 7 },
  chipActive: { backgroundColor: C.navy },
  chipText: { color: C.text, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: C.white },
  filterModalRoot: { flex: 1, justifyContent: 'flex-end' },
  filterModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7, 27, 49, 0.35)' },
  filterSheet: { backgroundColor: C.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: -6 } },
  filterSheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D8DEE6', alignSelf: 'center', marginBottom: 16 },
  filterPanelHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  filterPanelTitle: { fontSize: 20, fontWeight: '900', color: C.text, letterSpacing: -0.4 },
  filterPanelSub: { color: C.muted, fontSize: 12, marginTop: 3 },
  clearFiltersText: { color: C.blue, fontSize: 12, fontWeight: '800', paddingTop: 4 },
  filterSectionLabel: { color: C.muted, fontSize: 11, fontWeight: '800', marginTop: 11, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.5 },
  filterOptionRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  filterOption: { minHeight: 36, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F4F6F9', alignItems: 'center', justifyContent: 'center', margin: 3 },
  filterOptionActive: { backgroundColor: C.navy2 },
  filterOptionText: { color: C.text, fontSize: 12, fontWeight: '700' },
  filterOptionTextActive: { color: C.white },
  filterApplyButton: { height: 52, borderRadius: 15, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  filterApplyText: { color: C.white, fontSize: 15, fontWeight: '900' },
  mapMock: { flex: 1, minHeight: 420, backgroundColor: '#E9EEF3', position: 'relative' },
  mapCanvas: { ...StyleSheet.absoluteFillObject, backgroundColor: '#E9EEF3' },
  realMarkerWrap: { alignItems: 'center' },
  mapLocationPill: { position: 'absolute', top: 14, left: 14, minHeight: 40, borderRadius: 20, paddingHorizontal: 12, backgroundColor: '#FFFFFFEE', flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.09, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  mapLocationText: { marginLeft: 7, color: C.navy2, fontSize: 12, fontWeight: '700' },
  mapResultsPill: { position: 'absolute', top: 14, right: 14, minHeight: 38, borderRadius: 19, paddingHorizontal: 13, backgroundColor: '#FFFFFFEE', flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  mapResultsText: { color: C.navy2, fontSize: 12, fontWeight: '800' },
  mapReferenceLocationButton: { position: 'absolute', right: 14, bottom: 16, width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFFF2', alignItems: 'center', justifyContent: 'center', shadowColor: '#071B31', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  mapPreviewCard: { position: 'absolute', left: 14, right: 14, bottom: 14, backgroundColor: C.white, borderRadius: 22, padding: 14, shadowColor: '#071B31', shadowOpacity: 0.16, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, borderWidth: 1, borderColor: '#EEF1F5' },
  mapPreviewClose: { position: 'absolute', right: 12, top: 12, zIndex: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F5F8', alignItems: 'center', justifyContent: 'center' },
  mapPreviewTop: { flexDirection: 'row', alignItems: 'center', paddingRight: 30 },
  mapPreviewImage: { width: 58, height: 58, borderRadius: 18, marginRight: 12 },
  mapPreviewMain: { flex: 1 },
  mapPreviewNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mapPreviewName: { color: C.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.25 },
  mapPreviewRole: { color: C.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  mapPreviewMeta: { color: C.text, fontSize: 11, marginTop: 5 },
  mapPreviewInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  mapPreviewAvailable: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.greenSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  mapPreviewDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green, marginRight: 6 },
  mapPreviewAvailableText: { color: '#087A4E', fontSize: 10, fontWeight: '800' },
  mapPreviewPrice: { color: C.text, fontSize: 11, fontWeight: '800' },
  mapPreviewActions: { flexDirection: 'row', marginTop: 12, gap: 8 },
  mapPreviewSecondary: { height: 44, paddingHorizontal: 16, borderRadius: 13, backgroundColor: '#F3F5F8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  mapPreviewSecondaryText: { color: C.navy2, fontSize: 12, fontWeight: '800' },
  mapPreviewPrimary: { flex: 1, height: 44, borderRadius: 13, backgroundColor: C.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapPreviewPrimaryText: { color: C.white, fontSize: 12, fontWeight: '900' },
  mapMockCompact: { height: 320, minHeight: 320 },
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
  directoryHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 7 },
  directoryTitle: { fontSize: 21, fontWeight: '900', color: C.text },
  directoryCount: { color: C.muted, fontSize: 12, fontWeight: '700' },
  noResults: { paddingVertical: 54, paddingHorizontal: 24, alignItems: 'center' },
  noResultsTitle: { color: C.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  noResultsSub: { color: C.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 },
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
  pickHint: { color: C.muted, fontSize: 9, marginTop: 5 },
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
  messagesPage: { flex: 1, backgroundColor: C.white, paddingHorizontal: 18, paddingTop: 14 },
  messagesTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  messagesTitle: { color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.6 },
  messagesSub: { color: C.muted, fontSize: 13, marginTop: 4 },
  messagesLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messagesMuted: { color: C.muted, fontSize: 13 },
  inboxRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEF1F4', paddingVertical: 11 },
  inboxAvatar: { width: 52, height: 52, borderRadius: 18, marginRight: 12 },
  inboxAvatarFallback: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  inboxAvatarFallbackText: { color: C.blue, fontSize: 20, fontWeight: '900' },
  inboxMain: { flex: 1, paddingRight: 8 },
  inboxNameRow: { flexDirection: 'row', alignItems: 'center' },
  inboxName: { flex: 1, color: C.text, fontSize: 15, fontWeight: '900' },
  inboxTime: { color: '#9AA5B1', fontSize: 10, fontWeight: '700' },
  inboxTrade: { color: C.blue, fontSize: 11, fontWeight: '700', marginTop: 2 },
  inboxLast: { color: C.muted, fontSize: 12, marginTop: 4 },
  messagesEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, paddingBottom: 80 },
  messagesEmptyIcon: { width: 72, height: 72, borderRadius: 25, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  messagesEmptyTitle: { color: C.text, fontSize: 20, fontWeight: '900' },
  messagesEmptySub: { color: C.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7, maxWidth: 280 },
  messagesBrowseButton: { height: 48, borderRadius: 14, backgroundColor: C.blue, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  messagesBrowseText: { color: C.white, fontSize: 13, fontWeight: '900' },
  liveChatHeader: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#EEF1F4', backgroundColor: C.white },
  liveChatBack: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F4F6F9', alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  liveChatAvatar: { width: 44, height: 44, borderRadius: 15, marginRight: 10 },
  liveChatAvatarFallback: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  liveChatAvatarText: { color: C.blue, fontWeight: '900', fontSize: 17 },
  liveChatName: { color: C.text, fontSize: 15, fontWeight: '900' },
  liveChatRole: { color: C.muted, fontSize: 11, marginTop: 2 },
  liveChatBody: { flex: 1, backgroundColor: '#F6F8FB' },
  liveChatContent: { padding: 14, paddingBottom: 24 },
  liveBubble: { maxWidth: '80%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 17, marginBottom: 8 },
  liveBubbleMine: { alignSelf: 'flex-end', backgroundColor: C.blue, borderBottomRightRadius: 5 },
  liveBubbleTheirs: { alignSelf: 'flex-start', backgroundColor: C.white, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: '#EDF0F4' },
  liveBubbleText: { color: C.text, fontSize: 14, lineHeight: 19 },
  liveBubbleTextMine: { color: C.white },
  threadEmpty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 30 },
  threadEmptyTitle: { color: C.text, fontSize: 17, fontWeight: '900' },
  threadEmptySub: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 5 },
  liveComposer: { minHeight: 68, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 9, paddingBottom: 10, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: '#EEF1F4' },
  liveComposerInput: { flex: 1, minHeight: 44, maxHeight: 100, borderRadius: 20, backgroundColor: '#F3F5F8', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, color: C.text, fontSize: 14 },
  liveSendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  liveSendButtonDisabled: { opacity: 0.35 },
  customerProfileCard: { backgroundColor: C.pale, borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 14 },
  customerAvatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  customerAvatarText: { color: C.white, fontWeight: '900', fontSize: 25 },
  customerName: { fontSize: 19, fontWeight: '900', color: C.text },
  profileModalRoot: { flex: 1, justifyContent: 'flex-end' },
  profileModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,27,49,0.35)' },
  profileModalSheet: { backgroundColor: C.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30 },
  profileModalTitle: { color: C.text, fontSize: 21, fontWeight: '900', marginBottom: 10 },
  profileModalHint: { color: C.muted, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  profileFieldLabel: { color: C.muted, fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  profileField: { minHeight: 48, borderRadius: 13, backgroundColor: '#F3F5F8', color: C.text, paddingHorizontal: 13, fontSize: 14 },
  profileAddressField: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  notificationSettingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },

  settingsRow: {
    minHeight: 72,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  settingsLabel: { fontWeight: '800', color: C.text, fontSize: 14, lineHeight: 18 },
  settingsSubText: { color: C.muted, fontSize: 11, lineHeight: 15, marginTop: 4, maxWidth: 270 },
  settingsChevron: { fontSize: 24, color: '#8995A5', marginLeft: 12 },
  proSwitchCard: { backgroundColor: C.navy, borderRadius: 18, padding: 18, marginTop: 25, flexDirection: 'row', alignItems: 'center' },
  proSwitchTitle: { color: C.white, fontSize: 17, fontWeight: '900' },
  proSwitchSub: { color: '#B9CAD9', fontSize: 12, lineHeight: 17, marginTop: 4, maxWidth: 260 },
  proSwitchArrow: { color: C.cyan, fontSize: 30, marginLeft: 'auto' },
  tradePage: { padding: 18, paddingBottom: 100 },
  tradeEmptyLarge: { marginTop: 24, backgroundColor: '#0C2B45', borderRadius: 18, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#173F5F' },
  tradeEmptyLargeTitle: { color: C.white, fontSize: 17, fontWeight: '900', marginTop: 12 },
  tradeEmptyLargeText: { color: '#9FB5C7', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6, maxWidth: 290 },
  tradeChatHeader: { height: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, backgroundColor: C.navy, borderBottomWidth: 1, borderBottomColor: '#173F5F' },
  tradeChatBack: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#123B5B', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  tradeChatName: { color: C.white, fontSize: 15, fontWeight: '900' },
  tradeChatSub: { color: '#7890A4', fontSize: 10, marginTop: 2 },
  tradeChatBody: { flex: 1, backgroundColor: '#081D31' },
  tradeChatContent: { padding: 14, paddingBottom: 24 },
  tradeChatBubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10, marginBottom: 8 },
  tradeChatMine: { alignSelf: 'flex-end', backgroundColor: C.blue, borderBottomRightRadius: 5 },
  tradeChatTheirs: { alignSelf: 'flex-start', backgroundColor: '#123B5B', borderBottomLeftRadius: 5 },
  tradeChatBubbleText: { color: '#DCE6EF', fontSize: 13, lineHeight: 18 },
  tradeChatComposer: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, backgroundColor: C.navy, borderTopWidth: 1, borderTopColor: '#173F5F' },
  tradeChatInput: { flex: 1, minHeight: 43, borderRadius: 18, backgroundColor: '#102E47', color: C.white, paddingHorizontal: 14, fontSize: 13 },
  tradeChatSend: { width: 43, height: 43, borderRadius: 22, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },

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
  proProfileFallback: { width: 65, height: 65, borderRadius: 33, marginRight: 12, backgroundColor: '#123B5B', alignItems: 'center', justifyContent: 'center' },
  proProfileFallbackText: { color: C.cyan, fontSize: 24, fontWeight: '900' },
  locationSettingsCard: { backgroundColor: '#0C2B45', borderRadius: 18, padding: 15, marginTop: 14, marginBottom: 12, borderWidth: 1, borderColor: '#173F5F' },
  locationSettingsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  locationSettingsIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#123B5B', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  locationSettingsTitle: { color: C.white, fontSize: 17, fontWeight: '900' },
  locationSettingsSub: { color: '#96ADBF', fontSize: 11, marginTop: 3, lineHeight: 16 },
  locationChoice: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 14, backgroundColor: '#102E47', borderWidth: 1, borderColor: '#173F5F' },
  locationChoiceActive: { borderColor: C.blue, backgroundColor: '#123756' },
  locationChoiceRadio: { width: 19, height: 19, borderRadius: 10, borderWidth: 2, borderColor: '#5D7890', alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 },
  locationChoiceRadioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.blue },
  locationChoiceTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  locationChoiceTitle: { color: C.white, fontSize: 13, fontWeight: '900' },
  locationChoiceText: { color: '#A8BDCC', fontSize: 11, lineHeight: 16, marginTop: 5 },
  recommendedPill: { marginLeft: 7, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: '#0D6B50' },
  recommendedText: { color: '#B7F4DC', fontSize: 8, fontWeight: '900' },
  locationSaveButton: { minHeight: 42, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  locationSaveButtonText: { color: C.white, fontSize: 11, fontWeight: '900' },
  locationPrivacyNote: { color: '#7893A8', fontSize: 9, lineHeight: 14, marginTop: 10 },

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

  photoPicked: { width: 120, height: 105, borderRadius: 15 },
  tradeEmptyCard: { backgroundColor: '#0C2B45', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#173F5F' },
  tradeEmptyTitle: { color: C.white, fontSize: 14, fontWeight: '900' },
  tradeEmptyText: { color: '#9FB5C7', fontSize: 11, lineHeight: 17, marginTop: 5 },
  darkSettingsStatus: { color: '#7890A4', fontSize: 10, fontWeight: '700' },
  dispatchPromiseCard: {
    marginHorizontal: 18,
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#EEF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dispatchPromiseIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchPromiseTitle: { fontSize: 14, fontWeight: '900', color: C.navy2 },
  dispatchPromiseText: { marginTop: 3, fontSize: 11, lineHeight: 16, color: C.muted },
  locationPrivacyText: { marginTop: 3, fontSize: 10, lineHeight: 14, color: C.muted },
  dispatchEstimate: {
    marginTop: 6,
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.pale,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  dispatchEstimateLabel: { fontSize: 10, fontWeight: '700', color: C.muted },
  dispatchEstimatePrice: { marginTop: 2, fontSize: 20, fontWeight: '900', color: C.navy2 },
  dispatchEstimateNote: { maxWidth: 130, fontSize: 10, lineHeight: 14, textAlign: 'right', color: C.muted },
  dispatchSearchingPage: {
    flex: 1,
    backgroundColor: C.white,
    paddingHorizontal: 22,
    paddingBottom: 30,
    alignItems: 'center',
  },
  dispatchTopBar: {
    width: '100%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dispatchBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchTopTitle: { fontSize: 16, fontWeight: '900', color: C.navy2 },
  dispatchRadar: {
    width: 230,
    height: 230,
    marginTop: 34,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchRadarRingLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: '#DCEBFA',
    backgroundColor: '#F8FBFF',
  },
  dispatchRadarRingMedium: {
    position: 'absolute',
    width: 154,
    height: 154,
    borderRadius: 77,
    borderWidth: 1,
    borderColor: '#C7E2FF',
    backgroundColor: '#F1F8FF',
  },
  dispatchRadarRingSmall: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: '#A8D3FF',
    backgroundColor: '#EAF5FF',
  },
  dispatchRadarCentre: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.blue,
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  dispatchSearchingTitle: { marginTop: 16, fontSize: 24, fontWeight: '900', color: C.navy2, textAlign: 'center' },
  dispatchSearchingSub: { marginTop: 8, maxWidth: 340, fontSize: 13, lineHeight: 19, color: C.muted, textAlign: 'center' },
  dispatchSearchInfoCard: {
    width: '100%',
    marginTop: 28,
    padding: 16,
    borderRadius: 20,
    backgroundColor: C.pale,
  },
  dispatchInfoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dispatchInfoTitle: { fontSize: 13, fontWeight: '800', color: C.navy2 },
  dispatchInfoSub: { marginTop: 3, fontSize: 11, lineHeight: 16, color: C.muted },
  dispatchDivider: { height: 1, backgroundColor: C.line, marginVertical: 14 },
  dispatchCancelButton: {
    marginTop: 'auto',
    width: '100%',
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchCancelText: { fontSize: 14, fontWeight: '800', color: C.red },
  dispatchMatchedPage: { paddingHorizontal: 20, paddingBottom: 36, backgroundColor: C.white },
  dispatchSuccessIcon: {
    alignSelf: 'center',
    marginTop: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchMatchedTitle: { marginTop: 14, fontSize: 25, fontWeight: '900', color: C.navy2, textAlign: 'center' },
  dispatchMatchedSub: { marginTop: 7, fontSize: 12, lineHeight: 17, color: C.muted, textAlign: 'center' },
  dispatchProgress: {
    marginTop: 24,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dispatchProgressItem: { alignItems: 'center', width: '24%' },
  dispatchProgressDot: {
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD4DE',
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchProgressDotActive: { borderColor: C.blue, backgroundColor: C.blue },
  dispatchProgressText: { marginTop: 5, fontSize: 9, fontWeight: '700', color: '#96A0AC', textAlign: 'center' },
  dispatchProgressTextActive: { color: C.navy2 },
  dispatchMatchCard: {
    padding: 17,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: '#0B2745',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
  },
  dispatchMatchTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dispatchAvatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.pale },
  dispatchNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dispatchName: { fontSize: 17, fontWeight: '900', color: C.navy2, flexShrink: 1 },
  dispatchRole: { marginTop: 2, fontSize: 12, fontWeight: '700', color: C.muted },
  dispatchRating: { marginTop: 4, fontSize: 11, color: C.text },
  dispatchEtaBox: { alignItems: 'flex-end' },
  dispatchEtaNumber: { fontSize: 18, fontWeight: '900', color: C.navy2 },
  dispatchEtaLabel: { fontSize: 9, color: C.muted },
  dispatchTrustRow: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  dispatchAgreementNote: { marginTop: 14, fontSize: 10, lineHeight: 15, color: C.muted },
  dispatchActionRow: { marginTop: 16, flexDirection: 'row', gap: 8 },
  dispatchSecondaryAction: {
    height: 46,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: C.pale,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dispatchSecondaryText: { fontSize: 12, fontWeight: '800', color: C.navy2 },
  dispatchPrimaryAction: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchPrimaryText: { fontSize: 12, fontWeight: '900', color: C.white },
  dispatchJobSummary: { marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: C.pale },
  dispatchSummaryTitle: { fontSize: 12, fontWeight: '900', color: C.navy2 },
  dispatchSummaryTrade: { marginTop: 8, fontSize: 11, fontWeight: '800', color: C.blue },
  dispatchSummaryIssue: { marginTop: 5, fontSize: 13, lineHeight: 19, color: C.text },
  dispatchCancelOutline: {
    marginTop: 16,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D9E0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchCancelOutlineText: { fontSize: 13, fontWeight: '800', color: C.red },
  dispatchTradeSectionTitle: { marginTop: 22, marginBottom: 10, fontSize: 14, fontWeight: '900', color: C.white },
  dispatchTradeActiveCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#0E355A',
    borderWidth: 1,
    borderColor: '#1E4A72',
    marginBottom: 12,
  },
  dispatchTradeOfferCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#0D2D4B',
    borderWidth: 1,
    borderColor: '#1A4165',
    marginBottom: 12,
  },
  dispatchTradeTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dispatchTradeUrgentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchTradeUrgency: { fontSize: 10, fontWeight: '800', color: C.cyan },
  dispatchTradeJobTitle: { marginTop: 2, fontSize: 19, fontWeight: '900', color: C.white },
  dispatchTradeIssue: { marginTop: 13, fontSize: 13, lineHeight: 19, color: '#E7EEF6' },
  dispatchTradeMetaRow: { marginTop: 13, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  dispatchTradeMeta: { flexShrink: 1, fontSize: 10, color: '#AFC0D2' },
  dispatchTradeEtaPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 13, backgroundColor: '#123C61', alignItems: 'center' },
  dispatchTradeEtaValue: { fontSize: 12, fontWeight: '900', color: C.white },
  dispatchTradeEtaSmall: { fontSize: 8, color: '#9FB3C7' },
  dispatchTradeDecisionRow: { marginTop: 16, flexDirection: 'row', gap: 9 },
  dispatchTradeDecline: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#355575',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchTradeDeclineText: { fontSize: 12, fontWeight: '800', color: '#D7E2ED' },
  dispatchTradeAccept: {
    flex: 1.5,
    height: 46,
    borderRadius: 14,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchTradeAcceptText: { fontSize: 12, fontWeight: '900', color: C.white },
  dispatchTradeActionRow: { marginTop: 16, flexDirection: 'row', gap: 9 },
  dispatchTradeDirections: {
    flex: 1,
    height: 45,
    borderRadius: 13,
    backgroundColor: '#EAF3FC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dispatchTradeDirectionsText: { fontSize: 11, fontWeight: '800', color: C.navy2 },
  dispatchTradeAdvance: {
    flex: 1.4,
    height: 45,
    borderRadius: 13,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchTradeAdvanceText: { fontSize: 11, fontWeight: '900', color: C.white },

  dispatchTrackingMapWrap: {
    marginTop: 2,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: C.pale,
  },
  dispatchTrackingLabelRow: {
    height: 36,
    paddingHorizontal: 13,
    backgroundColor: C.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  dispatchTrackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green,
  },
  dispatchTrackingLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: C.navy2,
  },

});

