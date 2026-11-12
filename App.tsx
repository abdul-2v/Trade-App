import React, { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import AuthScreen from './AuthScreen';
import TradeSuppliersMap from './TradeSuppliersMap';
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
  Platform,
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
  | 'route'
  | 'booking'
  | 'requests'
  | 'requestDetail'
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
  source?: 'urgent' | 'job' | 'demo';
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

const marketJobStatusLabel = (status: string) => {
  if (status === 'posted' || status === 'offered') return 'Waiting for tradesperson';
  if (status === 'accepted') return 'Accepted';
  if (status === 'en_route') return 'On the way';
  if (status === 'arrived') return 'Arrived';
  if (status === 'in_progress') return 'In progress';
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'expired') return 'Expired';
  return 'Waiting for tradesperson';
};

const C = {
  navy: '#111C29',
  navy2: '#1D2B3A',
  navy3: '#2D4052',
  blue: '#375D79',
  cyan: '#D8E7F0',
  green: '#2F8A67',
  greenSoft: '#E7F2EA',
  text: '#1A1D19',
  muted: '#74786F',
  line: '#DDDACE',
  pale: '#F0EEE6',
  white: '#FFFDF8',
  gold: '#D89B32',
  orange: '#E5744C',
  red: '#C94E3E',
  canvas: '#F6F4ED',
  stone: '#E9E5D9',
  clay: '#E5744C',
  lime: '#E9D9C4',
  homeInk: '#111C29',
  homeSurface: '#1D2B3A',
  homeStone: '#F5F0E8',
  homeSlate: '#DBE4EB',
};

const DISPLAY_FONT = Platform.OS === 'ios' ? 'Avenir Next' : 'sans-serif';

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

const customerCategoryOrder: TradeCategory[] = [
  'Plumber',
  'Electrician',
  'Builder',
  'Heating',
  'Carpenter',
  'Locksmith',
  'Roofer',
];

const categoryDescriptions: Record<TradeCategory, string> = {
  Plumber: 'Leaks, taps, toilets & pipework',
  Electrician: 'Power, sockets, lighting & faults',
  Builder: 'Repairs, brickwork & renovations',
  Heating: 'Boilers, radiators & heating faults',
  Locksmith: 'Lockouts, locks & home security',
  Carpenter: 'Doors, joinery & fitted storage',
  Roofer: 'Leaks, tiles, gutters & roof repairs',
};

const serviceCatalog: Record<TradeCategory, string[]> = {
  Plumber: ['Emergency leak', 'Blocked drain', 'Toilet repair', 'Taps & pipework', 'Bathroom plumbing', 'Other plumbing job'],
  Electrician: ['Power fault', 'Sockets & switches', 'Lighting', 'Consumer unit', 'Electrical testing', 'Other electrical job'],
  Builder: ['General repair', 'Brickwork', 'Plastering', 'Renovation', 'Extension work', 'Other building job'],
  Heating: ['No heating', 'Boiler fault', 'Boiler service', 'Radiator issue', 'Central heating', 'Other heating job'],
  Locksmith: ['Locked out', 'Replace a lock', 'UPVC lock repair', 'Security upgrade', 'Key or access issue', 'Other locksmith job'],
  Carpenter: ['Door repair', 'Fitted storage', 'Shelving', 'Joinery repair', 'Furniture work', 'Other carpentry job'],
  Roofer: ['Roof leak', 'Broken tiles', 'Guttering', 'Flat roof', 'Roof inspection', 'Other roofing job'],
};

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
  const [serviceIntent, setServiceIntent] = useState<{ trade: TradeCategory; service: string; timing: string } | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);

  useEffect(() => {
    if (!session?.user.id || accountType !== 'customer') return;

    let active = true;
    let urgentChannel: any = null;
    let jobsChannel: any = null;

    const loadCustomerRequests = async () => {
      const userId = session.user.id;
      const [{ data: urgentRows }, { data: jobRows }] = await Promise.all([
        supabase
          .from('urgent_requests')
          .select('id, trade, issue, urgency, status, created_at')
          .eq('customer_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('jobs')
          .select('id, trade, issue, timing, job_mode, status, created_at')
          .eq('customer_id', userId)
          .order('created_at', { ascending: false }),
      ]);

      if (!active) return;

      const merged = [
        ...(urgentRows ?? []).map(row => ({
          id: row.id,
          trade: row.trade,
          issue: row.issue,
          urgency: row.urgency,
          status: dispatchStatusLabel(row.status),
          source: 'urgent' as const,
          createdAt: row.created_at,
        })),
        ...(jobRows ?? []).map(row => ({
          id: row.id,
          trade: row.trade,
          issue: row.issue,
          urgency:
            row.job_mode === 'street_run'
              ? 'Street Run · ' + row.timing
              : row.job_mode === 'route'
                ? 'On My Way · ' + row.timing
                : row.timing,
          status: marketJobStatusLabel(row.status),
          source: 'job' as const,
          createdAt: row.created_at,
        })),
      ]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map(({ createdAt, ...item }) => item);

      setRequests(merged);
    };

    loadCustomerRequests();

    urgentChannel = supabase
      .channel('customer-urgent-list-' + session.user.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'urgent_requests',
          filter: 'customer_id=eq.' + session.user.id,
        },
        loadCustomerRequests
      )
      .subscribe();

    jobsChannel = supabase
      .channel('customer-job-list-' + session.user.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: 'customer_id=eq.' + session.user.id,
        },
        loadCustomerRequests
      )
      .subscribe();

    return () => {
      active = false;
      if (urgentChannel) supabase.removeChannel(urgentChannel);
      if (jobsChannel) supabase.removeChannel(jobsChannel);
    };
  }, [session?.user.id, accountType]);


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
        intent={serviceIntent}
      />
    );
  }

  if (customerScreen === 'profile') {
    return (
      <TradeProfileScreen
        trade={selectedTrade}
        back={() => setCustomerScreen('map')}
        message={async () => {
          if (!selectedTrade.id.startsWith('live-')) {
            Alert.alert(
              'Demo profile',
              'This is sample marketplace data. Create a real tradesperson account to test live conversations.'
            );
            return;
          }

          const tradespersonId = selectedTrade.id.replace('live-', '');
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) return;

          const { data: customerProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single();

          const customerName =
            [customerProfile?.first_name, customerProfile?.last_name].filter(Boolean).join(' ') ||
            'Customer';

          const { error } = await supabase.from('conversations').upsert(
            {
              customer_id: user.id,
              tradesperson_id: tradespersonId,
              customer_display_name: customerName,
              tradesperson_display_name: selectedTrade.name,
              tradesperson_trade: selectedTrade.role,
              tradesperson_avatar_url: selectedTrade.image,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'customer_id,tradesperson_id' }
          );

          if (error) {
            Alert.alert('Could not open conversation', error.message);
            return;
          }

          setCustomerScreen('messages');
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
        initialTrade={serviceIntent?.trade || (selectedCategory === 'All' ? 'Plumber' : selectedCategory)}
        initialIssue={serviceIntent?.service}
      />
    );
  }

  if (customerScreen === 'route') {
    return (
      <RouteSaverScreen
        initialTrade={serviceIntent?.trade || (selectedCategory === 'All' ? 'Plumber' : selectedCategory)}
        initialService={serviceIntent?.service}
        back={() => setCustomerScreen('home')}
        navigate={setCustomerScreen}
        addRequest={request => setRequests(prev => [request, ...prev])}
      />
    );
  }

  if (customerScreen === 'booking') {
    return (
      <BookingScreen
        trade={selectedTrade}
        initialService={serviceIntent?.service}
        initialTiming={serviceIntent?.timing}
        back={() => setCustomerScreen('profile')}
        complete={async booking => {
          if (!selectedTrade.id.startsWith('live-')) {
            setRequests(prev => [
              {
                id: 'demo-booking-' + Date.now(),
                trade: selectedTrade.role,
                issue: booking.service + ' with ' + selectedTrade.name,
                urgency: booking.date + ' · ' + booking.time,
                status: 'Booked (demo)',
              },
              ...prev,
            ]);
            setCustomerScreen('requests');
            return;
          }

          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) throw new Error('Please sign in again.');

          const permission = await Location.requestForegroundPermissionsAsync();
          if (permission.status !== 'granted') {
            throw new Error('Location permission is needed so the tradesperson knows the job area.');
          }

          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          const tradespersonId = selectedTrade.id.replace('live-', '');
          const timing = booking.date + ' · ' + booking.time;
          const { data: job, error: jobError } = await supabase
            .from('jobs')
            .insert({
              customer_id: user.id,
              trade: selectedTrade.role,
              issue: booking.service,
              job_mode: 'normal',
              timing,
              latitude: Number(coords.latitude.toFixed(2)),
              longitude: Number(coords.longitude.toFixed(2)),
              location_label: 'Approximate scheduled job area',
              search_radius_miles: Math.max(1, Math.ceil(selectedTrade.distance + 1)),
              preferred_tradesperson_id: tradespersonId,
              status: 'offered',
            })
            .select('id')
            .single();

          if (jobError || !job) throw jobError || new Error('Could not create booking request.');

          const { error: locationError } = await supabase.from('job_locations').insert({
            job_id: job.id,
            customer_id: user.id,
            latitude: coords.latitude,
            longitude: coords.longitude,
            address_label: 'Customer job location',
          });

          if (locationError) {
            await supabase.from('jobs').update({ status: 'cancelled' }).eq('id', job.id);
            throw locationError;
          }

          const { error: offerError } = await supabase.from('job_offers').insert({
            job_id: job.id,
            tradesperson_id: tradespersonId,
            distance_miles: Number(selectedTrade.distance.toFixed(2)),
            eta_minutes: Math.max(8, selectedTrade.eta),
            status: 'offered',
          });

          if (offerError) {
            await supabase.from('jobs').update({ status: 'cancelled' }).eq('id', job.id);
            throw offerError;
          }

          setRequests(prev => [
            {
              id: job.id,
              trade: selectedTrade.role,
              issue: booking.service + ' with ' + selectedTrade.name,
              urgency: timing,
              status: 'Waiting for tradesperson',
              source: 'job',
            },
            ...prev,
          ]);

          setCustomerScreen('requests');
        }}
      />
    );
  }

  if (customerScreen === 'requestDetail' && selectedRequest) {
    return (
      <RequestDetailScreen
        request={selectedRequest}
        navigate={setCustomerScreen}
        openTrade={openTrade}
        startRelay={(trade, issue) => {
          setSelectedCategory(trade);
          setServiceIntent({ trade, service: issue, timing: 'Next few days' });
          setCustomerScreen('map');
        }}
      />
    );
  }

  if (customerScreen === 'requests') {
    return (
      <RequestsScreen
        requests={requests}
        navigate={setCustomerScreen}
        openRequest={request => {
          setSelectedRequest(request);
          setCustomerScreen('requestDetail');
        }}
      />
    );
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
    <MarketplaceHomeScreen
      selectedCategory={selectedCategory}
      setSelectedCategory={setSelectedCategory}
      openTrade={openTrade}
      navigate={setCustomerScreen}
      onOpenRoute={() => setCustomerScreen('route')}
      onStartIntent={(trade, service, timing) => {
        setSelectedCategory(trade);
        setServiceIntent({ trade, service, timing });
        setCustomerScreen(timing === 'Now' ? 'urgent' : timing === 'Flexible' ? 'route' : 'map');
      }}
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
    <SafeAreaView style={[styles.safe, dark && { backgroundColor: C.homeInk }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={[styles.screen, dark && { backgroundColor: C.homeInk }]}>{children}</View>
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
      label: 'Explore',
      route: 'map',
    },
    {
      icon: { ios: 'clock', android: 'history' },
      activeIcon: { ios: 'clock.fill', android: 'history' },
      label: 'Activity',
      route: 'requests',
    },
    {
      icon: { ios: 'message', android: 'chat_bubble' },
      activeIcon: { ios: 'message.fill', android: 'chat_bubble' },
      label: 'Inbox',
      route: 'messages',
    },
    {
      icon: { ios: 'person', android: 'person' },
      activeIcon: { ios: 'person.fill', android: 'person' },
      label: 'Account',
      route: 'customerProfile',
    },
  ];

  return (
    <View style={styles.v2Nav}>
      {items.map(item => {
        const active = current === item.route || (current === 'profile' && item.route === 'map');
        return (
          <Pressable
            key={item.route}
            style={styles.v2NavItem}
            onPress={() => navigate(item.route)}
          >
            <View style={[styles.v2NavIconWrap, active && styles.v2NavIconWrapActive]}>
              <AppIcon
                icon={active ? item.activeIcon : item.icon}
                size={20}
                color={active ? C.white : '#A8B3C0'}
              />
            </View>
            <Text style={[styles.v2NavLabel, active && styles.v2NavLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}


function MarketplaceHomeScreen({
  selectedCategory,
  setSelectedCategory,
  openTrade,
  navigate,
  onStartIntent,
  onOpenRoute,
}: {
  selectedCategory: TradeCategory | 'All';
  setSelectedCategory: (category: TradeCategory | 'All') => void;
  openTrade: (trade: Trade) => void;
  navigate: (screen: CustomerScreen) => void;
  onStartIntent: (trade: TradeCategory, service: string, timing: string) => void;
  onOpenRoute: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [address, setAddress] = useState('');
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowStep, setFlowStep] = useState<1 | 2 | 3>(1);
  const [flowTrade, setFlowTrade] = useState<TradeCategory | null>(null);
  const [flowService, setFlowService] = useState('');
  const [flowTiming, setFlowTiming] = useState('');
  const featured = trades.filter(item => item.available).slice(0, 5);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      const { data } = await supabase
        .from('profiles')
        .select('first_name, default_address')
        .eq('id', user.id)
        .single();
      if (!active || !data) return;
      setFirstName(data.first_name || '');
      setAddress(data.default_address || '');
    };
    load();
    return () => { active = false; };
  }, []);

  const beginFlow = (trade?: TradeCategory, urgent = false) => {
    setFlowTrade(trade || null);
    setFlowService('');
    setFlowTiming(urgent ? 'Now' : '');
    setFlowStep(trade ? 2 : 1);
    setFlowOpen(true);
  };

  const chooseTrade = (trade: TradeCategory) => {
    setFlowTrade(trade);
    setFlowService('');
    setFlowStep(2);
  };

  const chooseService = (service: string) => {
    setFlowService(service);
    setFlowStep(3);
  };

  const finishFlow = () => {
    if (!flowTrade || !flowService || !flowTiming) return;
    setSelectedCategory(flowTrade);
    setFlowOpen(false);
    onStartIntent(flowTrade, flowService, flowTiming);
  };

  return (
    <CustomerShell current="home" navigate={navigate} dark>
      <ScrollView
        style={styles.marketHome}
        contentContainerStyle={styles.marketHomeContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.marketHeader}>
          <View>
            <Text style={styles.marketGreeting}>{firstName ? 'Hi ' + firstName : 'TradeHub'}</Text>
            <Text style={styles.marketGreetingSub}>Find the right help, without the hassle.</Text>
          </View>
          <Pressable style={styles.marketAccountButton} onPress={() => navigate('customerProfile')}>
            <AppIcon icon={{ ios: 'person.fill', android: 'person' }} size={18} color={C.white} />
          </Pressable>
        </View>

        <Pressable style={styles.marketAddressCard} onPress={() => navigate('customerProfile')}>
          <View style={styles.marketAddressIcon}>
            <AppIcon icon={{ ios: 'location.fill', android: 'location_on' }} size={22} color={C.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.marketAddressEyebrow}>WHERE YOU NEED HELP</Text>
            <Text style={styles.marketAddressText} numberOfLines={1}>
              {address || 'Choose an address'}
            </Text>
          </View>
          <AppIcon icon={{ ios: 'chevron.right', android: 'chevron_right' }} size={17} color="#98A69E" />
        </Pressable>

        <Pressable style={styles.marketSearchCard} onPress={() => beginFlow()}>
          <View style={styles.marketSearchIcon}>
            <AppIcon icon={{ ios: 'magnifyingglass', android: 'search' }} size={20} color={C.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.marketSearchTitle}>What needs doing?</Text>
            <Text style={styles.marketSearchSub}>Tell us a little about the job</Text>
          </View>
          <View style={styles.marketSearchArrow}>
            <AppIcon icon={{ ios: 'arrow.right', android: 'arrow_forward' }} size={17} color={C.white} />
          </View>
        </Pressable>

        <View style={styles.marketActionPair}>
          <Pressable style={[styles.marketActionCard, styles.marketActionUrgent]} onPress={() => beginFlow(undefined, true)}
            accessibilityRole="button" accessibilityLabel="Find urgent help now">
            <View style={styles.marketActionTop}>
              <View style={styles.marketActionUrgentIcon}>
                <AppIcon icon={{ ios: 'bolt.fill', android: 'bolt' }} size={21} color={C.white} />
              </View>
              <AppIcon icon={{ ios: 'arrow.up.right', android: 'north_east' }} size={17} color={C.white} />
            </View>
            <Text style={styles.marketActionUrgentTitle}>Need help now?</Text>
            <Text style={styles.marketActionUrgentSub}>Send an urgent request to nearby pros.</Text>
          </Pressable>
          <Pressable style={[styles.marketActionCard, styles.marketActionFlexible]} onPress={onOpenRoute}
            accessibilityRole="button" accessibilityLabel="Find a flexible route booking">
            <View style={styles.marketActionTop}>
              <View style={styles.marketActionFlexibleIcon}>
                <AppIcon icon={{ ios: 'arrow.triangle.branch', android: 'alt_route' }} size={21} color="#27465E" />
              </View>
              <AppIcon icon={{ ios: 'arrow.up.right', android: 'north_east' }} size={17} color="#27465E" />
            </View>
            <Text style={styles.marketActionFlexibleTitle}>I'm flexible</Text>
            <Text style={styles.marketActionFlexibleSub}>Find a slot on a tradesperson's route.</Text>
          </Pressable>
        </View>

        <View style={styles.marketSectionHead}>
          <View>
            <Text style={styles.marketSectionTitle}>Browse by trade</Text>
            <Text style={styles.marketSectionSub}>Choose a service to get started</Text>
          </View>
        </View>

        <View style={styles.marketCategoryGrid}>
          {customerCategoryOrder.slice(0, 6).map((category, index) => {
            const meta = categories.find(item => item.label === category);
            return (
              <Pressable
                key={category}
                style={[styles.marketCategoryCard, index % 3 === 1 && styles.marketCategoryCardAlt]}
                onPress={() => beginFlow(category)}
                accessibilityRole="button"
                accessibilityLabel={'Find a ' + category.toLowerCase()}
              >
                <View style={styles.marketCategoryTop}>
                  <View style={styles.marketCategoryIcon}>
                    {meta ? <AppIcon icon={meta.icon} size={23} color="#C66A4A" /> : null}
                  </View>
                  <Text style={styles.marketCategoryIndex}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <Text style={styles.marketCategoryTitle}>{category}</Text>
                <View style={styles.marketCategoryFoot}>
                  <Text style={styles.marketCategorySub} numberOfLines={2}>{categoryDescriptions[category]}</Text>
                  <View style={styles.marketCategoryGo}>
                    <AppIcon icon={{ ios: 'arrow.up.right', android: 'north_east' }} size={15} color="#1A2C3C" />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.marketMoreServices} onPress={() => beginFlow()}>
          <View style={styles.marketMoreIcon}>
            <AppIcon icon={{ ios: 'square.grid.2x2.fill', android: 'apps' }} size={18} color={C.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.marketMoreTitle}>More trades & services</Text>
            <Text style={styles.marketMoreSub}>Roofing, specialist repairs and more</Text>
          </View>
          <AppIcon icon={{ ios: 'chevron.right', android: 'chevron_right' }} size={17} color="#89978F" />
        </Pressable>

        <Pressable style={styles.marketExploreCard}
          onPress={() => { setSelectedCategory('All'); navigate('map'); }}
          accessibilityRole="button" accessibilityLabel="Explore tradespeople in your area">
          <View style={styles.marketExploreIcon}>
            <AppIcon icon={{ ios: 'map.fill', android: 'map' }} size={23} color="#375D79" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.marketExploreTitle}>Explore nearby tradespeople</Text>
            <Text style={styles.marketExploreSub}>View profiles, locations and availability</Text>
          </View>
          <View style={styles.marketExploreArrow}>
            <AppIcon icon={{ ios: 'arrow.right', android: 'arrow_forward' }} size={18} color="#263B4E" />
          </View>
        </Pressable>

        <View style={styles.marketTrustCard}>
          <View style={styles.marketTrustIcon}>
            <AppIcon icon={{ ios: 'checkmark.shield.fill', android: 'verified_user' }} size={20} color={'#355E78'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.marketTrustTitle}>Know who you're contacting</Text>
            <Text style={styles.marketTrustSub}>Check reviews, insurance and credentials on each profile when available.</Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={flowOpen} transparent animationType="slide" onRequestClose={() => setFlowOpen(false)}>
        <View style={styles.marketFlowRoot}>
          <Pressable style={styles.marketFlowBackdrop} onPress={() => setFlowOpen(false)} />
          <View style={styles.marketFlowSheet}>
            <View style={styles.marketFlowHandle} />
            <View style={styles.marketFlowHeader}>
              <View>
                <Text style={styles.marketFlowStep}>STEP {flowStep} OF 3</Text>
                <Text style={styles.marketFlowTitle}>
                  {flowStep === 1 ? 'Choose a trade' : flowStep === 2 ? 'What needs doing?' : 'When do you need them?'}
                </Text>
              </View>
              <Pressable style={styles.marketFlowClose} onPress={() => setFlowOpen(false)}>
                <AppIcon icon={{ ios: 'xmark', android: 'close' }} size={17} color={C.text} />
              </Pressable>
            </View>

            <View style={styles.marketFlowProgress}>
              {[1, 2, 3].map(step => (
                <View key={step} style={[styles.marketFlowProgressBar, step <= flowStep && styles.marketFlowProgressBarActive]} />
              ))}
            </View>

            {flowStep === 1 ? (
              <ScrollView style={styles.marketFlowList} showsVerticalScrollIndicator={false}>
                {customerCategoryOrder.map(category => {
                  const meta = categories.find(item => item.label === category);
                  return (
                    <Pressable key={category} style={styles.marketFlowRow} onPress={() => chooseTrade(category)}>
                      <View style={styles.marketFlowRowIcon}>
                        {meta ? <AppIcon icon={meta.icon} size={19} color={C.blue} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.marketFlowRowTitle}>{category}</Text>
                        <Text style={styles.marketFlowRowSub}>{categoryDescriptions[category]}</Text>
                      </View>
                      <AppIcon icon={{ ios: 'chevron.right', android: 'chevron_right' }} size={16} color="#969C95" />
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {flowStep === 2 && flowTrade ? (
              <ScrollView style={styles.marketFlowList} showsVerticalScrollIndicator={false}>
                <Pressable style={styles.marketFlowBackLink} onPress={() => setFlowStep(1)}>
                  <AppIcon icon={{ ios: 'chevron.left', android: 'chevron_left' }} size={15} color={C.blue} />
                  <Text style={styles.marketFlowBackText}>{flowTrade}</Text>
                </Pressable>
                {serviceCatalog[flowTrade].map(service => (
                  <Pressable key={service} style={styles.marketFlowServiceRow} onPress={() => chooseService(service)}>
                    <Text style={styles.marketFlowServiceText}>{service}</Text>
                    <AppIcon icon={{ ios: 'chevron.right', android: 'chevron_right' }} size={16} color="#969C95" />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {flowStep === 3 ? (
              <View>
                <Pressable style={styles.marketFlowBackLink} onPress={() => setFlowStep(2)}>
                  <AppIcon icon={{ ios: 'chevron.left', android: 'chevron_left' }} size={15} color={C.blue} />
                  <Text style={styles.marketFlowBackText}>{flowService}</Text>
                </Pressable>
                {[
                  ['Now', 'Find someone available for an urgent job'],
                  ['Today', 'Show tradespeople who can fit you in today'],
                  ['Next few days', 'Compare nearby pros and arrange a time'],
                  ['Flexible', 'Save by fitting your job into a nearby tradesperson route'],
                ].map(([timing, copy]) => (
                  <Pressable
                    key={timing}
                    style={[styles.marketTimingRow, flowTiming === timing && styles.marketTimingRowActive]}
                    onPress={() => setFlowTiming(timing)}
                  >
                    <View style={[styles.marketRadio, flowTiming === timing && styles.marketRadioActive]}>
                      {flowTiming === timing ? <View style={styles.marketRadioDot} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.marketTimingTitle}>{timing}</Text>
                      <Text style={styles.marketTimingSub}>{copy}</Text>
                    </View>
                    {timing === 'Now' ? <View style={styles.marketUrgentMini}><Text style={styles.marketUrgentMiniText}>FAST</Text></View> : null}
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.marketContinue, !flowTiming && styles.marketContinueDisabled]}
                  onPress={finishFlow}
                  disabled={!flowTiming}
                >
                  <Text style={styles.marketContinueText}>{flowTiming === 'Now' ? 'Find available tradespeople' : flowTiming === 'Flexible' ? 'Find cheaper route slots' : 'Show matching tradespeople'}</Text>
                  <AppIcon icon={{ ios: 'arrow.right', android: 'arrow_forward' }} size={17} color={C.white} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </CustomerShell>
  );
}


function RouteSaverScreen({
  initialTrade,
  initialService,
  back,
  navigate,
  addRequest,
}: {
  initialTrade: TradeCategory;
  initialService?: string | null;
  back: () => void;
  navigate: (screen: CustomerScreen) => void;
  addRequest: (request: RequestItem) => void;
}) {
  const [trade, setTrade] = useState<TradeCategory>(initialTrade);
  const [service, setService] = useState(initialService || serviceCatalog[initialTrade][0]);
  const [deadline, setDeadline] = useState<'Today' | '48 hours' | 'This week'>('48 hours');
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [streetRun, setStreetRun] = useState(false);
  const [reserving, setReserving] = useState(false);

  useEffect(() => {
    if (!serviceCatalog[trade].includes(service)) {
      setService(serviceCatalog[trade][0]);
    }
    setSelectedSlot(0);
  }, [trade]);

  const candidates = trades
    .filter(item => item.role === trade && item.available)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  const dayLabel = deadline === 'Today' ? 'Today' : deadline === '48 hours' ? 'Tomorrow' : 'Thu';
  const slots = candidates.map((item, index) => {
    const standard = Math.max(item.callout, 55);
    const saving = Math.max(12, Math.round(standard * (0.18 + index * 0.03)));
    const routePrice = standard - saving;
    const detour = Math.max(2, Math.round(item.distance * 2.2 + index));
    const times = ['12:40–1:20pm', '3:10–4:00pm', '9:30–10:15am'];
    return { item, standard, saving, routePrice, detour, slot: times[index] || 'Flexible slot' };
  });

  const reserve = async () => {
    const match = slots[selectedSlot];
    if (!match || reserving) return;

    setReserving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Please sign in again.');

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('Location permission is needed to find route-compatible tradespeople nearby.');
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      const [{ data: availabilityRows }, { data: profileRows }, { data: presenceRows }] = await Promise.all([
        supabase
          .from('trade_availability')
          .select('user_id, radius_miles')
          .eq('is_available', true),
        supabase
          .from('tradesperson_profiles')
          .select('user_id, primary_trade, display_name, avatar_url, rating, review_count, is_verified, is_insured, public_phone, bio')
          .eq('primary_trade', trade),
        supabase
          .from('trade_map_presence')
          .select('user_id, latitude, longitude'),
      ]);

      const availabilityMap = new Map(
        (availabilityRows ?? []).map(row => [row.user_id, Number(row.radius_miles) || 10])
      );
      const presenceMap = new Map(
        (presenceRows ?? []).map(row => [
          row.user_id,
          { latitude: Number(row.latitude), longitude: Number(row.longitude) },
        ])
      );

      const liveCandidates = (profileRows ?? [])
        .map(profile => {
          const publicLocation = presenceMap.get(profile.user_id);
          const radius = availabilityMap.get(profile.user_id);
          if (!publicLocation || !radius) return null;
          const distance = distanceMilesBetween(coords, publicLocation);
          if (distance > radius) return null;
          return {
            profile,
            distance,
            eta: estimatedDispatchEta(distance),
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.distance - b.distance)
        .slice(0, 8) as any[];

      const extraStreetSaving = streetRun ? 8 : 0;
      const timing = deadline + ' · flexible route slot';

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          customer_id: user.id,
          trade,
          issue: service,
          job_mode: streetRun ? 'street_run' : 'route',
          timing,
          latitude: Number(coords.latitude.toFixed(2)),
          longitude: Number(coords.longitude.toFixed(2)),
          location_label: 'Approximate flexible job area',
          search_radius_miles: 15,
          status: liveCandidates.length ? 'offered' : 'posted',
          standard_price: match.standard,
          route_price: Math.max(1, match.routePrice - extraStreetSaving),
          detour_minutes: match.detour,
        })
        .select('id')
        .single();

      if (jobError || !job) throw jobError || new Error('Could not create flexible job.');

      const { error: exactLocationError } = await supabase.from('job_locations').insert({
        job_id: job.id,
        customer_id: user.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address_label: 'Customer job location',
      });

      if (exactLocationError) {
        await supabase.from('jobs').update({ status: 'cancelled' }).eq('id', job.id);
        throw exactLocationError;
      }

      if (liveCandidates.length) {
        const offerRows = liveCandidates.map(candidate => ({
          job_id: job.id,
          tradesperson_id: candidate.profile.user_id,
          distance_miles: Number(candidate.distance.toFixed(2)),
          eta_minutes: candidate.eta,
          quoted_price: match.standard,
          route_price: Math.max(1, match.routePrice - extraStreetSaving),
          detour_minutes: Math.max(2, Math.round(candidate.distance * 2.2)),
          status: 'offered',
        }));

        const { error: offerError } = await supabase.from('job_offers').insert(offerRows);
        if (offerError) {
          await supabase.from('jobs').update({ status: 'cancelled' }).eq('id', job.id);
          throw offerError;
        }
      }

      addRequest({
        id: job.id,
        trade,
        issue: service,
        urgency: (streetRun ? 'Street Run' : 'On My Way') + ' · ' + timing,
        status: liveCandidates.length ? 'Waiting for tradesperson' : 'Posted — waiting for local supply',
        source: 'job',
      });

      Alert.alert(
        streetRun ? 'Street Run request posted' : 'On My Way request posted',
        liveCandidates.length
          ? 'Sent to ' + liveCandidates.length + ' real available ' + trade.toLowerCase() + (liveCandidates.length === 1 ? '.' : 's.')
          : 'Your job is saved, but no real available ' + trade.toLowerCase() + ' accounts are online inside the search area yet.'
      );
      navigate('requests');
    } catch (error: any) {
      Alert.alert('Could not post flexible job', error?.message || 'Please try again.');
    } finally {
      setReserving(false);
    }
  };

  return (
    <CustomerShell current="home" navigate={navigate}>
      <ScrollView style={styles.routeScreen} contentContainerStyle={styles.routeScreenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.routeHeader}>
          <Pressable style={styles.routeBack} onPress={back}>
            <AppIcon icon={{ ios: 'chevron.left', android: 'chevron_left' }} size={18} color={C.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeEyebrow}>TRADEHUB ROUTE</Text>
            <Text style={styles.routeTitle}>On My Way</Text>
          </View>
          <View style={styles.routeSavePill}><Text style={styles.routeSavePillText}>SAVE</Text></View>
        </View>

        <View style={styles.routeExplainCard}>
          <View style={styles.routeExplainIcon}>
            <AppIcon icon={{ ios: 'arrow.triangle.branch', android: 'alt_route' }} size={24} color={C.orange} />
          </View>
          <Text style={styles.routeExplainTitle}>Pay less when you can be flexible.</Text>
          <Text style={styles.routeExplainText}>
            We look for professionals already passing close to your area with a gap in their day. Less dead mileage means a cheaper slot for you.
          </Text>
          <View style={styles.routeExplainSteps}>
            <Text style={styles.routeExplainStep}>1  Pick the job</Text>
            <Text style={styles.routeExplainStep}>2  Pick a deadline</Text>
            <Text style={styles.routeExplainStep}>3  Take a route slot</Text>
          </View>
        </View>

        <Text style={styles.routeSectionLabel}>WHAT NEEDS DOING</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routeTradeRow}>
          {customerCategoryOrder.map(item => (
            <Pressable
              key={item}
              style={[styles.routeTradeChip, trade === item && styles.routeTradeChipActive]}
              onPress={() => setTrade(item)}
            >
              <Text style={[styles.routeTradeChipText, trade === item && styles.routeTradeChipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routeServiceRow}>
          {serviceCatalog[trade].map(item => (
            <Pressable
              key={item}
              style={[styles.routeServiceChip, service === item && styles.routeServiceChipActive]}
              onPress={() => setService(item)}
            >
              <Text style={[styles.routeServiceChipText, service === item && styles.routeServiceChipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.routeSectionLabel}>HOW FLEXIBLE ARE YOU?</Text>
        <View style={styles.routeDeadlineRow}>
          {(['Today', '48 hours', 'This week'] as const).map(item => (
            <Pressable
              key={item}
              style={[styles.routeDeadline, deadline === item && styles.routeDeadlineActive]}
              onPress={() => setDeadline(item)}
            >
              <Text style={[styles.routeDeadlineText, deadline === item && styles.routeDeadlineTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        {deadline !== 'Today' ? (
          <Pressable
            style={[styles.streetRunCard, streetRun && styles.streetRunCardActive]}
            onPress={() => setStreetRun(value => !value)}
          >
            <View style={styles.streetRunIcon}>
              <AppIcon icon={{ ios: 'house.and.flag.fill', android: 'location_city' }} size={20} color={streetRun ? C.navy : C.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.streetRunTitleRow}>
                <Text style={styles.streetRunEyebrow}>STREET RUN</Text>
                <View style={styles.streetRunSave}><Text style={styles.streetRunSaveText}>EXTRA £8 OFF</Text></View>
              </View>
              <Text style={styles.streetRunTitle}>Join nearby jobs on the same run.</Text>
              <Text style={styles.streetRunText}>4 homes within about 1.2 miles are waiting for small jobs. Batch the route and everyone pays less.</Text>
            </View>
            <View style={[styles.streetRunCheck, streetRun && styles.streetRunCheckActive]}>
              {streetRun ? <AppIcon icon={{ ios: 'checkmark', android: 'check' }} size={14} color={C.navy} /> : null}
            </View>
          </Pressable>
        ) : null}

        <View style={styles.routeMatchHeader}>
          <View>
            <Text style={styles.routeMatchTitle}>Best route matches</Text>
            <Text style={styles.routeMatchSub}>Slots are based on nearby work already in their day.</Text>
          </View>
          <View style={styles.routeMatchCount}><Text style={styles.routeMatchCountText}>{slots.length}</Text></View>
        </View>

        {slots.length ? slots.map((match, index) => (
          <Pressable
            key={match.item.id}
            style={[styles.routeSlotCard, selectedSlot === index && styles.routeSlotCardActive]}
            onPress={() => setSelectedSlot(index)}
          >
            <View style={styles.routeSlotTop}>
              <Image source={{ uri: match.item.image }} style={styles.routeSlotAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeSlotName}>{match.item.name}</Text>
                <Text style={styles.routeSlotMeta}>★ {match.item.rating} · {match.item.distance.toFixed(1)} mi away</Text>
              </View>
              <View style={styles.routeSlotSaving}><Text style={styles.routeSlotSavingText}>SAVE £{match.saving + (streetRun ? 8 : 0)}</Text></View>
            </View>

            <View style={styles.routeSlotJourney}>
              <View style={styles.routeSlotJourneyItem}>
                <Text style={styles.routeSlotJourneyLabel}>ROUTE SLOT</Text>
                <Text style={styles.routeSlotJourneyValue}>{dayLabel} · {match.slot}</Text>
              </View>
              <View style={styles.routeSlotDivider} />
              <View style={styles.routeSlotJourneyItem}>
                <Text style={styles.routeSlotJourneyLabel}>EXTRA DETOUR</Text>
                <Text style={styles.routeSlotJourneyValue}>+{match.detour} min</Text>
              </View>
            </View>

            <View style={styles.routePriceRow}>
              <Text style={styles.routeWasPrice}>Standard £{match.standard}</Text>
              <Text style={styles.routePrice}>£{Math.max(1, match.routePrice - (streetRun ? 8 : 0))}</Text>
            </View>
          </Pressable>
        )) : (
          <View style={styles.routeNoMatch}>
            <Text style={styles.routeNoMatchTitle}>No route slots yet</Text>
            <Text style={styles.routeNoMatchText}>Try a wider deadline or another trade. Normal nearby professionals are still available in Explore.</Text>
          </View>
        )}

        {slots.length ? (
          <Pressable
            style={[styles.routeReserveButton, reserving && { opacity: 0.6 }]}
            onPress={reserve}
            disabled={reserving}
          >
            {reserving ? (
              <ActivityIndicator color={C.navy} />
            ) : (
              <>
                <Text style={styles.routeReserveText}>Post flexible job</Text>
                <AppIcon icon={{ ios: 'arrow.right', android: 'arrow_forward' }} size={17} color={C.navy} />
              </>
            )}
          </Pressable>
        ) : null}

        <Text style={styles.routeFootnote}>Route slots are confirmed only after the professional accepts the stop in their schedule.</Text>
      </ScrollView>
    </CustomerShell>
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
  const nearby = visible.slice(0, 4);

  return (
    <CustomerShell current="home" navigate={navigate}>
      <ScrollView
        style={styles.v2HomeScreen}
        contentContainerStyle={styles.v2HomeContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.v2TopBar}>
          <View style={styles.v2BrandLockup}>
            <View style={styles.v2BrandMark}>
              <AppIcon icon={{ ios: 'hammer.fill', android: 'construction' }} size={18} color={C.navy} />
            </View>
            <View>
              <Text style={styles.v2Brand}>TradeHub</Text>
              <Text style={styles.v2BrandSub}>Local trades, made simple</Text>
            </View>
          </View>

          <Pressable style={styles.v2LocationPill} onPress={() => navigate('map')}>
            <AppIcon icon={{ ios: 'location.fill', android: 'location_on' }} size={14} color={C.blue} />
            <Text style={styles.v2LocationText}>Near you</Text>
          </Pressable>
        </View>

        <View style={styles.v2HeroCard}>
          <View style={styles.v2HeroTopRow}>
            <View style={styles.v2Eyebrow}>
              <View style={styles.v2EyebrowDot} />
              <Text style={styles.v2EyebrowText}>VERIFIED LOCAL PROS</Text>
            </View>
            <View style={styles.v2HeroMiniMark}>
              <View style={styles.v2HeroMiniLine} />
              <View style={[styles.v2HeroMiniLine, { width: 17 }]} />
              <View style={[styles.v2HeroMiniLine, { width: 10 }]} />
            </View>
          </View>

          <Text style={styles.v2HeroTitle}>Get the job done</Text>
          <Text style={[styles.v2HeroTitle, { marginTop: 0 }]}>without the runaround.</Text>
          <Text style={styles.v2HeroBody}>
            Find trusted tradespeople nearby, compare who is available and get help when you actually need it.
          </Text>

          <Pressable style={styles.v2Search} onPress={() => navigate('map')}>
            <View style={styles.v2SearchIcon}>
              <AppIcon icon={{ ios: 'magnifyingglass', android: 'search' }} size={19} color={C.navy2} />
            </View>
            <Text style={styles.v2SearchText}>What do you need doing?</Text>
            <View style={styles.v2SearchGo}>
              <AppIcon icon={{ ios: 'arrow.up.right', android: 'north_east' }} size={17} color={C.navy} />
            </View>
          </Pressable>

          <View style={styles.v2TrustRow}>
            <View style={styles.v2TrustItem}>
              <Text style={styles.v2TrustValue}>4.8+</Text>
              <Text style={styles.v2TrustLabel}>top-rated local pros</Text>
            </View>
            <View style={styles.v2TrustDivider} />
            <View style={styles.v2TrustItem}>
              <Text style={styles.v2TrustValue}>Live</Text>
              <Text style={styles.v2TrustLabel}>availability & location</Text>
            </View>
          </View>
        </View>

        <View style={styles.v2SectionHead}>
          <View>
            <Text style={styles.v2SectionEyebrow}>START HERE</Text>
            <Text style={styles.v2SectionTitle}>What do you need?</Text>
          </View>
          <Pressable onPress={() => navigate('map')}>
            <Text style={styles.v2SectionLink}>See all</Text>
          </Pressable>
        </View>

        <View style={styles.v2CategoryGrid}>
          {categories.map(item => {
            const active = selectedCategory === item.label && item.label !== 'More';
            return (
              <Pressable
                key={item.label}
                style={[styles.v2CategoryTile, active && styles.v2CategoryTileActive]}
                onPress={() => {
                  if (item.label === 'More') {
                    setSelectedCategory('All');
                    navigate('map');
                    return;
                  }
                  setSelectedCategory(active ? 'All' : item.label);
                }}
              >
                <View style={[styles.v2CategoryIcon, active && styles.v2CategoryIconActive]}>
                  <AppIcon icon={item.icon} size={21} color={active ? C.navy : C.blue} />
                </View>
                <Text style={styles.v2CategoryLabel}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.v2UrgentCard} onPress={() => navigate('urgent')}>
          <View style={styles.v2UrgentLeft}>
            <View style={styles.v2UrgentTag}>
              <View style={styles.v2UrgentTagDot} />
              <Text style={styles.v2UrgentTagText}>URGENT DISPATCH</Text>
            </View>
            <Text style={styles.v2UrgentTitle}>Need someone today?</Text>
            <Text style={styles.v2UrgentBody}>
              Send the job to nearby available tradespeople and match with the first suitable pro.
            </Text>
          </View>
          <View style={styles.v2UrgentAction}>
            <AppIcon icon={{ ios: 'bolt.fill', android: 'bolt' }} size={22} color={C.navy} />
          </View>
        </Pressable>

        <View style={styles.v2SectionHead}>
          <View>
            <Text style={styles.v2SectionEyebrow}>AVAILABLE NOW</Text>
            <Text style={styles.v2SectionTitle}>Nearby professionals</Text>
          </View>
          <Pressable onPress={() => navigate('map')}>
            <Text style={styles.v2SectionLink}>Map</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.v2NearbyRow}>
          {nearby.map(trade => (
            <Pressable key={trade.id} style={styles.v2NearbyCard} onPress={() => openTrade(trade)}>
              <View style={styles.v2NearbyImageWrap}>
                <Image source={{ uri: trade.image }} style={styles.v2NearbyImage} />
                <View style={styles.v2OnlineDot} />
              </View>
              <Text style={styles.v2NearbyName} numberOfLines={1}>{trade.name}</Text>
              <Text style={styles.v2NearbyRole}>{trade.role}</Text>
              <View style={styles.v2NearbyMetaRow}>
                <Text style={styles.v2NearbyRating}>★ {trade.rating}</Text>
                <Text style={styles.v2NearbyDotText}>•</Text>
                <Text style={styles.v2NearbyDistance}>{trade.distance} mi</Text>
              </View>
              <View style={styles.v2NearbyFooter}>
                <Text style={styles.v2NearbyEta}>~{trade.eta} min</Text>
                <View style={styles.v2NearbyArrow}>
                  <AppIcon icon={{ ios: 'arrow.right', android: 'arrow_forward' }} size={15} color={C.navy} />
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable style={styles.v2MapCallout} onPress={() => navigate('map')}>
          <View style={styles.v2MapGlyph}>
            <AppIcon icon={{ ios: 'map.fill', android: 'map' }} size={21} color={C.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.v2MapCalloutTitle}>Explore your area</Text>
            <Text style={styles.v2MapCalloutSub}>See available tradespeople grouped neatly on the live map.</Text>
          </View>
          <AppIcon icon={{ ios: 'chevron.right', android: 'chevron_right' }} size={18} color={C.muted} />
        </Pressable>
      </ScrollView>
    </CustomerShell>
  );
}

function MapScreen({
  selectedCategory,
  setSelectedCategory,
  openTrade,
  navigate,
  intent,
}: {
  selectedCategory: TradeCategory | 'All';
  setSelectedCategory: (category: TradeCategory | 'All') => void;
  openTrade: (trade: Trade) => void;
  navigate: (screen: CustomerScreen) => void;
  intent?: { trade: TradeCategory; service: string; timing: string } | null;
}) {
  const [listMode, setListMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [maxDistance, setMaxDistance] = useState(5);
  const [minRating, setMinRating] = useState(0);
  const [availableOnly, setAvailableOnly] = useState(true);
  const [selectedMapTrade, setSelectedMapTrade] = useState<Trade | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveTrades, setLiveTrades] = useState<Trade[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketIsLive, setMarketIsLive] = useState(false);

  const marketplaceTrades = marketIsLive ? liveTrades : trades;

  const filtered = marketplaceTrades.filter(trade => {
    const query = searchQuery.trim().toLowerCase();
    if (query && !trade.name.toLowerCase().includes(query) && !trade.role.toLowerCase().includes(query)) return false;
    if (selectedCategory !== 'All' && trade.role !== selectedCategory) return false;
    if (trade.distance > maxDistance) return false;
    if (trade.rating < minRating) return false;
    if (availableOnly && !trade.available) return false;
    return true;
  });

  useEffect(() => {
    let active = true;
    const channels: any[] = [];

    const loadMarketplace = async () => {
      let reference = { latitude: 52.6369, longitude: -1.1398 };

      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          reference = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        }
      } catch {
        // Fall back to Leicester centre for distance ordering.
      }

      const [{ data: profiles, error: profileError }, { data: availability }, { data: presence }] =
        await Promise.all([
          supabase
            .from('tradesperson_profiles')
            .select('user_id, display_name, primary_trade, avatar_url, public_phone, is_verified, is_insured, rating, review_count, bio'),
          supabase
            .from('trade_availability')
            .select('user_id, is_available, radius_miles, available_until, location_mode'),
          supabase
            .from('trade_map_presence')
            .select('user_id, latitude, longitude, source_mode, updated_at'),
        ]);

      if (!active) return;

      if (profileError || !profiles?.length) {
        setLiveTrades([]);
        setMarketIsLive(false);
        setMarketLoading(false);
        return;
      }

      const availabilityMap = new Map((availability ?? []).map(row => [row.user_id, row]));
      const presenceMap = new Map((presence ?? []).map(row => [row.user_id, row]));
      const now = Date.now();

      const realTrades = profiles
        .map(profile => {
          const role = profile.primary_trade as TradeCategory;
          const spot = presenceMap.get(profile.user_id);
          const status = availabilityMap.get(profile.user_id);

          if (!customerCategoryOrder.includes(role) || !spot) return null;

          const untilOk =
            !status?.available_until ||
            new Date(status.available_until).getTime() > now;

          const freshLive =
            spot.source_mode !== 'live' ||
            !spot.updated_at ||
            now - new Date(spot.updated_at).getTime() <= 15 * 60 * 1000;

          const isAvailable = Boolean(status?.is_available && untilOk && freshLive);
          const latitude = Number(spot.latitude);
          const longitude = Number(spot.longitude);
          const distance = distanceMilesBetween(reference, { latitude, longitude });

          const item: Trade = {
            id: 'live-' + profile.user_id,
            name: profile.display_name || 'Local tradesperson',
            role,
            distance: Number(distance.toFixed(1)),
            eta: estimatedDispatchEta(distance),
            rating: Number(profile.rating) || 0,
            reviews: Number(profile.review_count) || 0,
            image: profile.avatar_url || 'https://i.pravatar.cc/600?u=' + profile.user_id,
            accent: C.green,
            callout: 0,
            available: isAvailable,
            verified: Boolean(profile.is_verified),
            insured: Boolean(profile.is_insured),
            response: estimatedDispatchEta(distance),
            years: 0,
            phone: profile.public_phone || '',
            about: profile.bio || 'Local trade professional on TradeHub.',
            services: serviceCatalog[role].slice(0, 5),
            mapLatitude: latitude,
            mapLongitude: longitude,
          };

          return item;
        })
        .filter(Boolean)
        .sort((a, b) => (a as Trade).distance - (b as Trade).distance) as Trade[];

      setLiveTrades(realTrades);
      setMarketIsLive(realTrades.length > 0);
      setMarketLoading(false);
    };

    const start = async () => {
      await loadMarketplace();

      for (const table of ['tradesperson_profiles', 'trade_availability', 'trade_map_presence']) {
        const channel = supabase
          .channel('marketplace-' + table)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table },
            () => loadMarketplace()
          )
          .subscribe();
        channels.push(channel);
      }
    };

    start();

    return () => {
      active = false;
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, []);

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
        {marketLoading ? (
          <View style={styles.marketDataBanner}>
            <ActivityIndicator size="small" color={C.green} />
            <Text style={styles.marketDataBannerText}>Loading live TradeHub professionals…</Text>
          </View>
        ) : marketIsLive ? (
          <View style={[styles.marketDataBanner, styles.marketDataBannerLive]}>
            <View style={styles.marketDataDot} />
            <Text style={styles.marketDataBannerText}>Live marketplace · real TradeHub accounts</Text>
          </View>
        ) : (
          <View style={styles.marketDataBanner}>
            <AppIcon icon={{ ios: 'flask.fill', android: 'science' }} size={14} color={C.orange} />
            <Text style={styles.marketDataBannerText}>Demo profiles shown until a real trade account publishes a work area.</Text>
          </View>
        )}

        {intent ? (
          <View style={styles.mapIntentCard}>
            <View style={styles.mapIntentIcon}>
              <AppIcon icon={{ ios: 'sparkles', android: 'auto_awesome' }} size={16} color={C.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mapIntentLabel}>MATCHING FOR</Text>
              <Text style={styles.mapIntentText} numberOfLines={1}>{intent.service}</Text>
            </View>
            <View style={styles.mapIntentTiming}>
              <Text style={styles.mapIntentTimingText}>{intent.timing}</Text>
            </View>
          </View>
        ) : null}
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
                <Text style={styles.mapPreviewPrice}>
                  {selectedMapTrade.callout > 0 ? 'From £' + selectedMapTrade.callout + ' call-out' : 'Ask for price'}
                </Text>
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
        markers.length === 1 ||
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
  const isLiveProfile = trade.id.startsWith('live-');

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
          <Text style={styles.profileName}>
            {trade.name}{trade.verified ? <Text style={{ color: C.blue }}> ✓</Text> : null}
          </Text>
          <Text style={styles.profileRole}>{trade.role}{trade.secondaryRole ? ' · ' + trade.secondaryRole : ''}</Text>
          <View style={styles.profileMetaRow}>
            <Text style={styles.ratingText}>
              {trade.reviews > 0 ? '⭐ ' + trade.rating + ' (' + trade.reviews + ' reviews)' : 'New on TradeHub'}
            </Text>
            <Text style={styles.muted}>⌖ {trade.distance} miles away</Text>
          </View>

          <View style={styles.badgeRow}>
            <Badge text={trade.available ? '● Available now' : 'Offline'} green={trade.available} />
            {trade.verified ? <Badge text="✓ Verified" /> : null}
            {trade.insured ? <Badge text="◆ Insured" dark /> : null}
            {trade.gasSafe ? <Badge text="⚠ Gas Safe" gold /> : null}
          </View>

          <View style={styles.statRow}>
            <Stat icon="⚡" value={isLiveProfile ? (trade.available ? 'Live now' : 'Offline') : 'in ' + trade.response + ' mins'} label={isLiveProfile ? 'Availability' : 'Typically responds'} />
            <Stat icon="◷" value={trade.years > 0 ? trade.years + '+ years' : 'Not added'} label="Experience" />
            <Stat icon="£" value={trade.callout > 0 ? 'from £' + trade.callout : 'Ask'} label="Call-out" />
            <Stat icon="◇" value={trade.verified ? 'Verified' : 'New'} label="Profile" />
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
                  <Text style={styles.lineRight}>{trade.callout > 0 ? 'From £' + trade.callout : 'Ask for price'}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {tab === 'Reviews' ? (
            <View style={styles.jobReviewCard}>
              {isLiveProfile ? (
                <>
                  <Text style={styles.reviewName}>
                    {trade.reviews > 0 ? trade.reviews + ' verified job review' + (trade.reviews === 1 ? '' : 's') : 'No verified reviews yet'}
                  </Text>
                  <Text style={styles.bodyText}>
                    {trade.reviews > 0
                      ? 'The ' + trade.rating + '/5 rating above is calculated only from completed TradeHub jobs.'
                      : 'Reviews appear here only after a real TradeHub job has been completed and the customer submits a rating.'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.reviewName}>Demo review · ⭐⭐⭐⭐⭐</Text>
                  <Text style={styles.bodyText}>Sample review content for the demo marketplace profile.</Text>
                </>
              )}
            </View>
          ) : null}

          {tab === 'Gallery' ? (
            isLiveProfile ? (
              <View style={styles.jobReviewCard}>
                <Text style={styles.reviewName}>No portfolio photos yet</Text>
                <Text style={styles.bodyText}>Real portfolio uploads will appear here once this professional adds them.</Text>
              </View>
            ) : (
              <View style={styles.galleryGrid}>
                {[1, 2, 3, 4].map(n => (
                  <View key={n} style={styles.galleryTile}><Text style={styles.galleryEmoji}>{['🚿', '🔧', '🏠', '♨'][n - 1]}</Text></View>
                ))}
              </View>
            )
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable
          style={[styles.secondaryAction, !trade.phone && { opacity: 0.38 }]}
          disabled={!trade.phone}
          onPress={() => trade.phone && Linking.openURL('tel:' + trade.phone)}
        >
          <Text style={styles.secondaryActionText}>{trade.phone ? '☎ Call' : 'No phone'}</Text>
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
  initialTrade,
  initialIssue,
}: {
  back: () => void;
  openTrade: (trade: Trade) => void;
  addRequest: (request: RequestItem) => void;
  navigate: (screen: CustomerScreen) => void;
  initialTrade?: TradeCategory;
  initialIssue?: string;
}) {
  const [trade, setTrade] = useState<TradeCategory>(initialTrade || 'Plumber');
  const [issue, setIssue] = useState(initialIssue || 'Leaking pipe under kitchen sink');
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

      const approximateLatitude = Number(coords.latitude.toFixed(2));
      const approximateLongitude = Number(coords.longitude.toFixed(2));

      const { data: request, error: requestError } = await supabase
        .from('urgent_requests')
        .insert({
          customer_id: user.id,
          trade,
          issue: issue.trim(),
          urgency,
          latitude: approximateLatitude,
          longitude: approximateLongitude,
          location_label: 'Approximate job area',
          photo_url: null,
          search_radius_miles: searchRadius,
          status: 'searching',
        })
        .select('id')
        .single();

      if (requestError || !request) throw requestError || new Error('Could not create request');

      const { error: exactLocationError } = await supabase
        .from('urgent_request_locations')
        .insert({
          request_id: request.id,
          customer_id: user.id,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });

      if (exactLocationError) {
        await supabase
          .from('urgent_requests')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', request.id);
        throw exactLocationError;
      }

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
                {demoMode ? 'Demo position' : 'Live tradesperson location'}
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

function BookingScreen({
  trade,
  back,
  complete,
  initialService,
  initialTiming,
}: {
  trade: Trade;
  back: () => void;
  complete: (booking: { service: string; date: string; time: string }) => Promise<void> | void;
  initialService?: string | null;
  initialTiming?: string | null;
}) {
  const [service, setService] = useState(initialService || trade.services[0]);
  const dates = ['Today', 'Tomorrow', 'This weekend'];
  const times = ['08:00–10:00', '10:00–12:00', '14:00–16:00', 'Flexible'];
  const [dateIndex, setDateIndex] = useState(initialTiming === 'Today' ? 0 : 1);
  const [timeIndex, setTimeIndex] = useState(initialTiming === 'Flexible' ? 3 : 1);
  const [submitting, setSubmitting] = useState(false);

  const submitBooking = async () => {
    setSubmitting(true);
    try {
      await complete({
        service,
        date: dates[dateIndex],
        time: times[timeIndex],
      });
    } catch (error: any) {
      Alert.alert('Could not send booking request', error?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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

        {Array.from(new Set([...(initialService ? [initialService] : []), ...trade.services, 'Emergency call-out', 'Other'])).map(item => (
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

        <Pressable
          style={[styles.largeBlueButton, submitting && { opacity: 0.55 }]}
          onPress={submitBooking}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color={C.white} /> : <Text style={styles.largeBlueText}>Send booking request</Text>}
        </Pressable>
      </ScrollView>
    </CustomerShell>
  );
}

function RequestsScreen({
  requests,
  navigate,
  openRequest,
}: {
  requests: RequestItem[];
  navigate: (screen: CustomerScreen) => void;
  openRequest: (request: RequestItem) => void;
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
        <Text style={styles.pageTitle}>Activity</Text>
        <Text style={styles.pageSub}>Requests, bookings and jobs you have in progress.</Text>

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={C.blue} />
            <Text style={styles.emptyBody}>Loading your requests…</Text>
          </View>
        ) : combined.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>◷</Text>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>Your urgent requests and scheduled jobs will stay organised here.</Text>
            <Pressable style={styles.largeBlueButton} onPress={() => navigate('urgent')}>
              <Text style={styles.largeBlueText}>Need someone now?</Text>
            </Pressable>
          </View>
        ) : (
          combined.map(item => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.requestCard,
                styles.requestCardPressable,
                pressed && styles.requestCardPressed,
              ]}
              onPress={() => openRequest(item)}
            >
              <View style={styles.requestTop}>
                <Text style={styles.requestTrade}>{item.trade}</Text>
                <View style={styles.requestStatusRow}>
                  <Badge
                    text={item.status}
                    green={['Matched', 'On the way', 'Arrived', 'Completed', 'Booked', 'Route slot held'].includes(item.status)}
                  />
                  <AppIcon icon={{ ios: 'chevron.right', android: 'chevron_right' }} size={18} color="#9AA6B3" />
                </View>
              </View>
              <Text style={styles.requestIssue}>{item.issue}</Text>
              <Text style={styles.muted}>{item.urgency}</Text>
              <Text style={styles.requestTapHint}>Tap to view request</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </CustomerShell>
  );
}

function RequestDetailScreen({
  request,
  navigate,
  openTrade,
  startRelay,
}: {
  request: RequestItem;
  navigate: (screen: CustomerScreen) => void;
  openTrade: (trade: Trade) => void;
  startRelay: (trade: TradeCategory, issue: string) => void;
}) {
  const isMarketJob = request.source === 'job';
  const isRoute = isMarketJob && /On My Way|Street Run/i.test(request.urgency);
  const isDemo = request.source === 'demo' || request.id.startsWith('demo-') || /^\d+$/.test(request.id);
  const [loading, setLoading] = useState(!isDemo);
  const [liveStatus, setLiveStatus] = useState(request.status);
  const [details, setDetails] = useState<any>(null);
  const [matchedTrade, setMatchedTrade] = useState<Trade | null>(() => {
    if (!isDemo || isRoute) return null;
    return (
      trades
        .filter(item => item.role === request.trade && item.available)
        .sort((a, b) => a.eta - b.eta)[0] || null
    );
  });
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);


  const buildMatchedTrade = async (row: any) => {
    if (!row?.accepted_tradesperson_id) {
      setMatchedTrade(null);
      return;
    }

    const userId = row.accepted_tradesperson_id;
    const [{ data: profile }, { data: locationRows }, { data: offerRows }] = await Promise.all([
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
      supabase
        .from(isMarketJob ? 'job_offers' : 'urgent_request_offers')
        .select('distance_miles, eta_minutes')
        .eq(isMarketJob ? 'job_id' : 'request_id', request.id)
        .eq('tradesperson_id', userId)
        .limit(1),
    ]);

    if (!profile) return;

    const location = locationRows?.[0];
    const offer = offerRows?.[0];

    setMatchedTrade({
      id: 'live-' + userId,
      name: profile.display_name || 'Local tradesperson',
      role: (profile.primary_trade || request.trade) as TradeCategory,
      distance: Number(offer?.distance_miles) || 0,
      eta: Number(row.estimated_arrival_minutes || offer?.eta_minutes) || 10,
      rating: Number(profile.rating) || 0,
      reviews: Number(profile.review_count) || 0,
      image: profile.avatar_url || 'https://i.pravatar.cc/600?u=' + userId,
      accent: C.blue,
      callout: 0,
      available: true,
      verified: Boolean(profile.is_verified),
      insured: Boolean(profile.is_insured),
      response: Number(row.estimated_arrival_minutes || offer?.eta_minutes) || 10,
      years: 0,
      phone: profile.public_phone || '',
      about: profile.bio || 'Available for your request.',
      services: [isMarketJob ? 'Booked work' : 'Urgent call-out'],
      mapLatitude: location ? Number(location.latitude) : undefined,
      mapLongitude: location ? Number(location.longitude) : undefined,
    });
  };

  const loadRequest = async () => {
    if (isDemo) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from(isMarketJob ? 'jobs' : 'urgent_requests')
      .select(
        isMarketJob
          ? 'id, trade, issue, timing, job_mode, status, accepted_tradesperson_id, created_at'
          : 'id, trade, issue, urgency, status, accepted_tradesperson_id, estimated_arrival_minutes, created_at'
      )
      .eq('id', request.id)
      .single();

    if (error || !data) {
      setLoading(false);
      Alert.alert('Request unavailable', 'We could not load this request.');
      return;
    }

    setDetails(data);
    setLiveStatus(isMarketJob ? marketJobStatusLabel(data.status) : dispatchStatusLabel(data.status));
    await buildMatchedTrade(data);

    if (data.status === 'completed' && !isMarketJob) {
      const { data: reviewRows } = await supabase
        .from('job_reviews')
        .select('rating, comment')
        .eq('request_id', request.id)
        .limit(1);

      const existingReview = reviewRows?.[0];
      if (existingReview) {
        setReviewRating(Number(existingReview.rating) || 0);
        setReviewComment(existingReview.comment || '');
        setReviewSubmitted(true);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadRequest();

    if (isDemo) return;

    const channel = supabase
      .channel('request-detail-' + request.id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: isMarketJob ? 'jobs' : 'urgent_requests',
          filter: 'id=eq.' + request.id,
        },
        async payload => {
          const row = payload.new as any;
          setDetails(row);
          setLiveStatus(isMarketJob ? marketJobStatusLabel(row.status) : dispatchStatusLabel(row.status));
          await buildMatchedTrade(row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [request.id, isMarketJob]);

  useEffect(() => {
    if (isDemo || !matchedTrade?.id.startsWith('live-')) return;

    const userId = matchedTrade.id.replace('live-', '');
    const channel = supabase
      .channel('request-detail-location-' + userId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trade_locations',
          filter: 'user_id=eq.' + userId,
        },
        payload => {
          const row = payload.new as any;
          setMatchedTrade(previous =>
            previous
              ? {
                  ...previous,
                  mapLatitude: Number(row.latitude),
                  mapLongitude: Number(row.longitude),
                }
              : previous
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchedTrade?.id, isDemo]);

  const cancelRequest = async () => {
    if (isDemo) {
      setLiveStatus('Cancelled');
      return;
    }

    const { error } = await supabase
      .from(isMarketJob ? 'jobs' : 'urgent_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', request.id);

    if (error) {
      Alert.alert('Could not cancel request', error.message);
      return;
    }

    setLiveStatus('Cancelled');
  };

  const messageTrade = async () => {
    if (!matchedTrade || isDemo) {
      Alert.alert(
        'Demo request',
        'This is a fake matched request for testing. Real matched requests open a live conversation here.'
      );
      return;
    }

    const tradeUserId = matchedTrade.id.replace('live-', '');
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('customer_id', user.id)
      .eq('tradesperson_id', tradeUserId)
      .limit(1);

    if (!existing?.length) {
      const { error } = await supabase.from('conversations').insert({
        customer_id: user.id,
        tradesperson_id: tradeUserId,
      });

      if (error) {
        Alert.alert('Could not open chat', error.message);
        return;
      }
    }

    navigate('messages');
  };

  const submitReview = async () => {
    if (isDemo || isMarketJob || !details?.accepted_tradesperson_id || reviewSubmitted) return;

    if (!reviewRating) {
      Alert.alert('Choose a rating', 'Tap a star before submitting your review.');
      return;
    }

    setReviewBusy(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setReviewBusy(false);
      return;
    }

    const { error } = await supabase.from('job_reviews').insert({
      request_id: request.id,
      customer_id: user.id,
      tradesperson_id: details.accepted_tradesperson_id,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    });

    if (error) {
      setReviewBusy(false);
      Alert.alert('Could not submit review', error.message);
      return;
    }

    const { data: ratingRow } = await supabase
      .from('tradesperson_profiles')
      .select('rating, review_count')
      .eq('user_id', details.accepted_tradesperson_id)
      .single();

    if (ratingRow) {
      setMatchedTrade(previous =>
        previous
          ? {
              ...previous,
              rating: Number(ratingRow.rating) || reviewRating,
              reviews: Number(ratingRow.review_count) || 1,
            }
          : previous
      );
    }

    setReviewSubmitted(true);
    setReviewBusy(false);
  };

  const displayIssue = details?.issue || request.issue;
  const displayUrgency = (isMarketJob ? details?.timing : details?.urgency) || request.urgency;
  const rawStatus = details?.status || (isDemo ? 'matched' : isMarketJob ? 'posted' : 'searching');
  const canCancel = isMarketJob
    ? ['posted', 'offered'].includes(rawStatus)
    : !['completed', 'cancelled', 'expired'].includes(rawStatus);

  return (
    <CustomerShell current="requests" navigate={navigate}>
      <ScrollView contentContainerStyle={styles.requestDetailPage} showsVerticalScrollIndicator={false}>
        <View style={styles.requestDetailHeader}>
          <Pressable style={styles.dispatchBackButton} onPress={() => navigate('requests')}>
            <AppIcon icon={{ ios: 'chevron.left', android: 'arrow_back' }} size={21} color={C.navy2} />
          </Pressable>
          <Text style={styles.requestDetailHeaderTitle}>Request details</Text>
          <View style={{ width: 42 }} />
        </View>

        {loading ? (
          <View style={styles.requestDetailLoading}>
            <ActivityIndicator color={C.blue} size="large" />
            <Text style={styles.messagesMuted}>Loading your request…</Text>
          </View>
        ) : (
          <>
            <View style={styles.requestDetailStatusCard}>
              <View style={styles.requestDetailStatusTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestDetailTrade}>{details?.trade || request.trade}</Text>
                  <Text style={styles.requestDetailUrgency}>{displayUrgency}</Text>
                </View>
                <Badge
                  text={isRoute ? liveStatus : isDemo ? 'Matched (demo)' : liveStatus}
                  green={['Matched', 'Accepted', 'On the way', 'Arrived', 'In progress', 'Completed'].includes(liveStatus)}
                />
              </View>
              <Text style={styles.requestDetailIssue}>{displayIssue}</Text>
            </View>

            {isDemo && !isRoute ? (
              <View style={styles.requestDemoNotice}>
                <AppIcon icon={{ ios: 'flask.fill', android: 'science' }} size={17} color={C.blue} />
                <Text style={styles.requestDemoNoticeText}>
                  This is a demo request because there were no real available tradesperson accounts when you sent it.
                </Text>
              </View>
            ) : null}

            {matchedTrade ? (
              <>
                <Text style={styles.requestDetailSectionTitle}>
                  {liveStatus === 'Completed' ? 'Tradesperson' : 'Matched tradesperson'}
                </Text>

                {matchedTrade.mapLatitude && matchedTrade.mapLongitude ? (
                  <View style={styles.requestDetailMap}>
                    <MapMock trades={[matchedTrade]} onTrade={() => openTrade(matchedTrade)} compact />
                  </View>
                ) : null}

                <View style={styles.requestDetailTradeCard}>
                  <Image source={{ uri: matchedTrade.image }} style={styles.requestDetailAvatar} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.dispatchNameRow}>
                      <Text style={styles.requestDetailName}>{matchedTrade.name}</Text>
                      {matchedTrade.verified ? (
                        <AppIcon icon={{ ios: 'checkmark.seal.fill', android: 'verified' }} size={17} color={C.blue} />
                      ) : null}
                    </View>
                    <Text style={styles.requestDetailRole}>{matchedTrade.role}</Text>
                    <Text style={styles.requestDetailMeta}>
                      {matchedTrade.rating ? '⭐ ' + matchedTrade.rating + ' · ' : ''}
                      {matchedTrade.distance ? matchedTrade.distance.toFixed(1) + ' mi · ' : ''}
                      ~{matchedTrade.eta} min ETA
                    </Text>
                  </View>
                </View>

                <View style={styles.requestDetailActions}>
                  <Pressable
                    style={styles.requestDetailSecondary}
                    onPress={() => {
                      if (isDemo) {
                        Alert.alert('Demo request', 'Calling is disabled for fake test profiles.');
                        return;
                      }
                      if (matchedTrade.phone) Linking.openURL('tel:' + matchedTrade.phone);
                    }}
                  >
                    <AppIcon icon={{ ios: 'phone.fill', android: 'call' }} size={18} color={C.navy2} />
                    <Text style={styles.requestDetailSecondaryText}>Call</Text>
                  </Pressable>

                  <Pressable style={styles.requestDetailSecondary} onPress={messageTrade}>
                    <AppIcon icon={{ ios: 'message.fill', android: 'chat_bubble' }} size={18} color={C.navy2} />
                    <Text style={styles.requestDetailSecondaryText}>Message</Text>
                  </Pressable>

                  <Pressable style={styles.requestDetailPrimary} onPress={() => openTrade(matchedTrade)}>
                    <Text style={styles.requestDetailPrimaryText}>Profile</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.requestDetailSearchingCard}>
                <ActivityIndicator color={C.blue} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestDetailSearchingTitle}>
                    {liveStatus === 'Cancelled'
                      ? 'Request cancelled'
                      : isMarketJob
                        ? isRoute ? 'Flexible job awaiting a match' : 'Booking awaiting response'
                        : 'Still searching'}
                  </Text>
                  <Text style={styles.requestDetailSearchingText}>
                    {liveStatus === 'Cancelled'
                      ? 'This request is no longer being sent to tradespeople.'
                      : isMarketJob
                        ? isRoute
                          ? 'Real nearby tradespeople have been offered this flexible job. Once one accepts, their profile and status will appear here.'
                          : 'Your selected tradesperson has been sent this booking request.'
                        : 'TradeHub is waiting for one of the nearby available tradespeople to accept.'}
                  </Text>
                </View>
              </View>
            )}

            {liveStatus === 'Completed' && !isDemo && !isMarketJob && matchedTrade ? (
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeaderRow}>
                  <View style={styles.reviewIcon}>
                    <AppIcon icon={{ ios: 'star.fill', android: 'star' }} size={19} color={C.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewEyebrow}>JOB COMPLETE</Text>
                    <Text style={styles.reviewTitle}>
                      {reviewSubmitted ? 'Thanks for your review' : 'How did it go?'}
                    </Text>
                  </View>
                </View>

                {reviewSubmitted ? (
                  <View style={styles.reviewSubmittedRow}>
                    <Text style={styles.reviewSubmittedStars}>{'★'.repeat(reviewRating)}</Text>
                    <Text style={styles.reviewSubmittedText}>Your rating is now part of this tradesperson's live profile.</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.reviewText}>Rate {matchedTrade.name}. This can only be submitted after a completed real job.</Text>
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map(value => (
                        <Pressable
                          key={value}
                          style={styles.reviewStarButton}
                          onPress={() => setReviewRating(value)}
                        >
                          <Text style={[styles.reviewStar, value <= reviewRating && styles.reviewStarActive]}>★</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      value={reviewComment}
                      onChangeText={setReviewComment}
                      style={styles.reviewInput}
                      placeholder="Anything useful for future customers? (optional)"
                      placeholderTextColor="#8E918A"
                      multiline
                      maxLength={500}
                    />
                    <Pressable
                      style={[styles.reviewSubmit, (!reviewRating || reviewBusy) && { opacity: 0.45 }]}
                      onPress={submitReview}
                      disabled={!reviewRating || reviewBusy}
                    >
                      {reviewBusy ? <ActivityIndicator color={C.navy} /> : <Text style={styles.reviewSubmitText}>Submit review</Text>}
                    </Pressable>
                  </>
                )}
              </View>
            ) : null}

            {liveStatus === 'Completed' ? (
              <View style={styles.relayCard}>
                <View style={styles.relayHeader}>
                  <View style={styles.relayIcon}>
                    <AppIcon icon={{ ios: 'arrow.triangle.branch', android: 'alt_route' }} size={19} color={C.orange} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.relayEyebrow}>TRADEHUB RELAY</Text>
                    <Text style={styles.relayTitle}>Does the problem need another trade?</Text>
                  </View>
                </View>
                <Text style={styles.relayText}>
                  Pass the job context on instead of starting again. Your issue and previous trade stay attached to the next step.
                </Text>
                <View style={styles.relayOptions}>
                  {(
                    request.trade === 'Plumber'
                      ? (['Builder', 'Electrician', 'Carpenter'] as TradeCategory[])
                      : request.trade === 'Heating'
                        ? (['Electrician', 'Plumber', 'Builder'] as TradeCategory[])
                        : (['Plumber', 'Electrician', 'Builder'] as TradeCategory[])
                  ).map(nextTrade => (
                    <Pressable
                      key={nextTrade}
                      style={styles.relayOption}
                      onPress={() => startRelay(nextTrade, 'Follow-on work after ' + request.trade + ': ' + request.issue)}
                    >
                      <Text style={styles.relayOptionText}>{nextTrade}</Text>
                      <AppIcon icon={{ ios: 'arrow.right', android: 'arrow_forward' }} size={13} color={C.orange} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {canCancel && liveStatus !== 'Cancelled' ? (
              <Pressable style={styles.requestDetailCancel} onPress={cancelRequest}>
                <Text style={styles.requestDetailCancelText}>Cancel request</Text>
              </Pressable>
            ) : null}
          </>
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
      .select('id, tradesperson_id, tradesperson_display_name, tradesperson_trade, tradesperson_avatar_url, updated_at')
      .eq('customer_id', user.id)
      .order('updated_at', { ascending: false });

    if (error || !rows?.length) {
      setConversations([]);
      setLoadingInbox(false);
      return;
    }

    const conversationIds = rows.map(row => row.id);
    const { data: latestMessages } = await supabase
      .from('messages')
      .select('conversation_id, body, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    const latestByConversation = new Map<string, { body: string; created_at: string }>();

    for (const item of latestMessages ?? []) {
      if (!latestByConversation.has(item.conversation_id)) {
        latestByConversation.set(item.conversation_id, item);
      }
    }

    setConversations(
      rows.map(row => {
        const latest = latestByConversation.get(row.id);

        return {
          id: row.id,
          tradespersonId: row.tradesperson_id,
          name: row.tradesperson_display_name || 'Tradesperson',
          trade: row.tradesperson_trade || 'Trade professional',
          avatar: row.tradesperson_avatar_url || null,
          lastMessage: latest?.body || 'You are connected — say hello.',
          updatedAt: latest?.created_at || row.updated_at,
        };
      })
    );

    setLoadingInbox(false);
  };

  useEffect(() => {
    let channel: any = null;
    let active = true;

    const start = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !active) {
        setLoadingInbox(false);
        return;
      }

      await loadInbox();

      channel = supabase
        .channel('customer-conversations-' + user.id)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: 'customer_id=eq.' + user.id,
          },
          () => loadInbox()
        )
        .subscribe();
    };

    start();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!selectedConversation) {
      setThread([]);
      return;
    }

    let active = true;
    let channel: any = null;
    setLoadingThread(true);

    const start = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, sender_id, body, created_at')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true });

      if (!active) return;

      setThread((data as LiveMessage[]) ?? []);
      setLoadingThread(false);

      channel = supabase
        .channel('customer-thread-' + selectedConversation.id)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: 'conversation_id=eq.' + selectedConversation.id,
          },
          payload => {
            const incoming = payload.new as LiveMessage;
            setThread(previous =>
              previous.some(item => item.id === incoming.id)
                ? previous
                : [...previous, incoming]
            );
            loadInbox();
          }
        )
        .subscribe();
    };

    start();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
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

    setThread(prev =>
      prev.some(item => item.id === data.id) ? prev : [...prev, data as LiveMessage]
    );

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
            <Text style={styles.messagesSub}>Quotes, updates and conversations with tradespeople.</Text>
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
        <Text style={styles.pageTitle}>Account</Text>

        <View style={styles.customerProfileCard}>
          <View style={styles.customerAvatar}><Text style={styles.customerAvatarText}>{initial}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>{fullName}</Text>
            <Text style={styles.customerAccountType}>{accountType === 'tradesperson' ? 'Tradesperson account' : 'Customer account'}</Text>
          </View>
        </View>

        <Pressable style={styles.settingsRow} onPress={() => setEditMode('details')}>
          <View style={styles.v2SettingIcon}>
            <AppIcon icon={{ ios: 'person.text.rectangle', android: 'badge' }} size={19} color={C.blue} />
          </View>
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
          <View style={styles.v2SettingIcon}>
            <AppIcon icon={{ ios: 'heart', android: 'favorite_border' }} size={19} color={C.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingsLabel}>Saved tradespeople</Text>
            <Text style={styles.settingsSubText}>Your favourites will appear here</Text>
          </View>
          <Text style={styles.settingsChevron}>›</Text>
        </Pressable>

        <Pressable style={styles.settingsRow} onPress={() => setEditMode('address')}>
          <View style={styles.v2SettingIcon}>
            <AppIcon icon={{ ios: 'house', android: 'home' }} size={19} color={C.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingsLabel}>Address</Text>
            <Text style={styles.settingsSubText} numberOfLines={1}>
              {profile.default_address || 'Add your default job address'}
            </Text>
          </View>
          <Text style={styles.settingsChevron}>›</Text>
        </Pressable>

        <Pressable style={styles.settingsRow} onPress={() => setEditMode('notifications')}>
          <View style={styles.v2SettingIcon}>
            <AppIcon icon={{ ios: 'bell', android: 'notifications_none' }} size={19} color={C.blue} />
          </View>
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
          <View style={styles.v2SettingIcon}>
            <AppIcon icon={{ ios: 'questionmark.circle', android: 'help_outline' }} size={19} color={C.blue} />
          </View>
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
    <SafeAreaView style={[styles.safe, { backgroundColor: C.homeInk }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.screen, { backgroundColor: C.homeInk }]}>{children}</View>
      <View style={styles.tradeNav}>
        {items.map(item => (
          <Pressable key={item.route} style={styles.navItem} onPress={() => navigate(item.route)}>
            <View style={[styles.navIconWrap, item.route === current && styles.tradeNavIconActive]}>
              <AppIcon icon={item.icon} size={21} color={item.route === current ? C.white : '#AABAC9'} />
            </View>
            <Text style={[styles.navLabel, { color: item.route === current ? '#F2AE93' : '#AABAC9', fontWeight: item.route === current ? '900' : '600' }]}>{item.label}</Text>
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
  const [showWorkSettings, setShowWorkSettings] = useState(false);
  const [showPlanning, setShowPlanning] = useState(false);
  const [locationMode, setLocationMode] = useState<'work_area' | 'live'>('work_area');
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [profileTrade, setProfileTrade] = useState('Trade professional');
  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [radarBusy, setRadarBusy] = useState<string | null>(null);
  const [incomingOffers, setIncomingOffers] = useState<
    Array<{
      offerId: string;
      requestId: string;
      trade: string;
      issue: string;
      urgency: string;
      distance: number;
      eta: number;
    }>
  >([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !active) return;

      const [{ data: person }, { data: availability }, { data: tradeProfile }] = await Promise.all([
        supabase.from('profiles').select('first_name').eq('id', user.id).single(),
        supabase
          .from('trade_availability')
          .select('is_available, radius_miles, available_until, location_mode')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('tradesperson_profiles')
          .select('display_name, primary_trade, avatar_url, bio, public_phone, is_verified, is_insured')
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

      if (tradeProfile) {
        setProfileName(tradeProfile.display_name || person?.first_name || 'Your business');
        setProfileTrade(tradeProfile.primary_trade || 'Trade professional');
        setProfileAvatar(tradeProfile.avatar_url || null);
        const checks = [
          tradeProfile.display_name,
          tradeProfile.primary_trade,
          tradeProfile.avatar_url,
          tradeProfile.bio,
          tradeProfile.public_phone,
          tradeProfile.is_verified,
          tradeProfile.is_insured,
        ];
        setProfileCompletion(Math.round((checks.filter(Boolean).length / checks.length) * 100));
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let channel: any = null;

    const loadIncoming = async (knownUserId?: string) => {
      const userId =
        knownUserId ||
        (
          await supabase.auth.getUser()
        ).data.user?.id ||
        null;

      if (!userId || !active) return;

      const { data: offers } = await supabase
        .from('urgent_request_offers')
        .select('id, request_id, distance_miles, eta_minutes, offered_at')
        .eq('tradesperson_id', userId)
        .eq('status', 'offered')
        .order('offered_at', { ascending: false })
        .limit(3);

      if (!active || !offers?.length) {
        if (active) setIncomingOffers([]);
        return;
      }

      const ids = offers.map(item => item.request_id);
      const { data: requests } = await supabase
        .from('urgent_requests')
        .select('id, trade, issue, urgency, status')
        .in('id', ids)
        .eq('status', 'searching');

      const requestMap = new Map((requests ?? []).map(item => [item.id, item]));

      setIncomingOffers(
        offers
          .map(offer => {
            const request = requestMap.get(offer.request_id);
            if (!request) return null;

            return {
              offerId: offer.id,
              requestId: offer.request_id,
              trade: request.trade,
              issue: request.issue,
              urgency: request.urgency,
              distance: Number(offer.distance_miles) || 0,
              eta: Number(offer.eta_minutes) || 0,
            };
          })
          .filter(Boolean) as any
      );
    };

    const start = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !active) return;

      await loadIncoming(user.id);

      channel = supabase
        .channel('trade-home-offers-' + user.id)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'urgent_request_offers',
            filter: 'tradesperson_id=eq.' + user.id,
          },
          () => loadIncoming(user.id)
        )
        .subscribe();
    };

    start();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
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

  // Location presets, not fabricated live demand numbers.
  const demandAreas = [
    { name: 'LE5 · Evington / Hamilton', lat: 52.637, lng: -1.075 },
    { name: 'LE2 · Oadby / Stoneygate', lat: 52.607, lng: -1.087 },
    { name: 'LE4 · Belgrave / Birstall', lat: 52.670, lng: -1.120 },
  ];

  const workDemandArea = async (area: (typeof demandAreas)[number]) => {
    setRadarBusy(area.name);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setRadarBusy(null);
      return;
    }

    const { error } = await supabase
      .from('trade_availability')
      .update({
        is_available: true,
        location_mode: 'work_area',
        work_area_label: area.name,
        work_area_latitude: area.lat,
        work_area_longitude: area.lng,
        radius_miles: Math.max(radius, 5),
        available_until: durationToUntil(duration),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    setRadarBusy(null);

    if (error) {
      Alert.alert('Could not move work area', error.message);
      return;
    }

    setAvailable(true);
    setLocationMode('work_area');
    Alert.alert('Demand area selected', 'New matching jobs can now find you around ' + area.name + '.');
  };

  return (
    <TradeShell current="tradeHome" navigate={navigate}>
      <ScrollView contentContainerStyle={styles.tradePageV3} showsVerticalScrollIndicator={false}>
        <View style={styles.proV3Header}>
          <View>
            <Text style={styles.proV3Eyebrow}>TRADEHUB · FOR PROS</Text>
            <Text style={styles.proV3Hello}>Hi {firstName}</Text>
            <Text style={styles.proV3Sub}>Your work, all in one place.</Text>
          </View>
          <Pressable style={styles.proV3CustomerButton} onPress={switchToCustomer} accessibilityRole="button" accessibilityLabel="Switch to customer view">
            <AppIcon icon={{ ios: 'person.2.fill', android: 'group' }} size={17} color={C.white} />
          </Pressable>
        </View>

        <Pressable style={styles.proV3ProfileCard} onPress={() => navigate('tradeProfile')}>
          {profileAvatar ? (
            <Image source={{ uri: profileAvatar }} style={styles.proV3Avatar} />
          ) : (
            <View style={styles.proV3AvatarFallback}>
              <Text style={styles.proV3AvatarFallbackText}>{(profileName || firstName || 'T').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.proV3ProfileName}>{profileName || firstName || 'Your trade profile'}</Text>
            <Text style={styles.proV3ProfileTrade}>{profileTrade}</Text>
            <View style={styles.proV3ProgressTrack}>
              <View style={[styles.proV3ProgressFill, { width: (profileCompletion + '%') as any }]} />
            </View>
            <Text style={styles.proV3Completion}>{profileCompletion === 100 ? 'Profile ready' : profileCompletion + '% complete · tap to finish'}</Text>
          </View>
          <AppIcon icon={{ ios: 'chevron.right', android: 'chevron_right' }} size={17} color="#91A198" />
        </Pressable>

        <View style={[styles.proV3Availability, available && styles.proV3AvailabilityLive]}>
          <View style={styles.proV3AvailabilityIcon}>
            <AppIcon
              icon={{ ios: available ? 'checkmark.circle.fill' : 'moon.fill', android: available ? 'check_circle' : 'bedtime' }}
              size={22}
              color={available ? '#23516D' : '#9BAFC0'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.proV3AvailabilityTitle, available && { color: C.navy }]}>
              {available ? 'Available for new jobs' : 'Not taking new jobs'}
            </Text>
            <Text style={[styles.proV3AvailabilitySub, available && { color: '#4F6777' }]}>
              {savingAvailability
                ? 'Saving…'
                : available
                  ? 'Matching customers can send you requests.'
                  : 'Switch on when you are ready for new work.'}
            </Text>
          </View>
          <Switch
            value={available}
            onValueChange={changeAvailable}
            trackColor={{ false: '#43556A', true: '#6A94AE' }}
            thumbColor={available ? C.white : '#D8E0E6'}
            disabled={savingAvailability}
          />
        </View>

        <View style={styles.tradeSectionHeader}>
          <Text style={styles.tradeSectionTitle}>Incoming work</Text>
          <Pressable onPress={() => navigate('tradeJobs')}><Text style={styles.tradeLink}>View all</Text></Pressable>
        </View>

        {incomingOffers.length ? (
          <View style={styles.incomingLiveWrap}>
            {incomingOffers.map(offer => (
              <Pressable
                key={offer.offerId}
                style={styles.incomingLiveCard}
                onPress={() => navigate('tradeJobs')}
              >
                <View style={styles.incomingLiveTop}>
                  <View style={styles.incomingLivePulse}><View style={styles.incomingLivePulseDot} /></View>
                  <Text style={styles.incomingLiveUrgency}>{offer.urgency.toUpperCase()}</Text>
                  <Text style={styles.incomingLiveDistance}>{offer.distance.toFixed(1)} mi</Text>
                </View>
                <Text style={styles.incomingLiveTrade}>{offer.trade}</Text>
                <Text style={styles.incomingLiveIssue} numberOfLines={2}>{offer.issue}</Text>
                <View style={styles.incomingLiveFooter}>
                  <Text style={styles.incomingLiveEta}>~{offer.eta} min away</Text>
                  <View style={styles.incomingLiveButton}>
                    <Text style={styles.incomingLiveButtonText}>Review job</Text>
                    <AppIcon icon={{ ios: 'arrow.right', android: 'arrow_forward' }} size={13} color={C.navy} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.tradeEmptyCard}>
            <Text style={styles.tradeEmptyTitle}>No live opportunities yet</Text>
            <Text style={styles.tradeEmptyText}>Requests matching your trade, availability and work radius will appear here.</Text>
          </View>
        )}

        <View style={styles.proV3QuickGrid}>
          <Pressable style={styles.proV3QuickCard} onPress={() => navigate('tradeJobs')}>
            <View style={styles.proV3QuickIcon}>
              <AppIcon icon={{ ios: 'briefcase.fill', android: 'work' }} size={19} color={C.orange} />
            </View>
            <Text style={styles.proV3QuickValue}>{incomingOffers.length ? incomingOffers.length + ' new' : 'Jobs'}</Text>
            <Text style={styles.proV3QuickLabel}>{incomingOffers.length ? 'Tap to respond' : 'Offers & active work'}</Text>
          </Pressable>
          <Pressable style={styles.proV3QuickCard} onPress={() => navigate('tradeMap')}>
            <View style={styles.proV3QuickIcon}>
              <AppIcon icon={{ ios: 'location.fill', android: 'location_on' }} size={19} color={C.orange} />
            </View>
            <Text style={styles.proV3QuickValue}>Merchants</Text>
            <Text style={styles.proV3QuickLabel}>Suppliers near you</Text>
          </Pressable>
          <Pressable style={styles.proV3QuickCard} onPress={() => navigate('tradeProfile')}>
            <View style={styles.proV3QuickIcon}>
              <AppIcon icon={{ ios: 'checkmark.shield.fill', android: 'verified_user' }} size={19} color={C.orange} />
            </View>
            <Text style={styles.proV3QuickValue}>{profileCompletion}%</Text>
            <Text style={styles.proV3QuickLabel}>Profile readiness</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.proV3DetailsToggle}
          onPress={() => setShowWorkSettings(value => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showWorkSettings }}
        >
          <View style={styles.proV3DetailsIcon}>
            <AppIcon icon={{ ios: 'slider.horizontal.3', android: 'tune' }} size={19} color="#456A82" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.proV3DetailsTitle}>Work preferences</Text>
            <Text style={styles.proV3DetailsSub}>{duration} availability · {radius} mile radius</Text>
          </View>
          <AppIcon icon={{ ios: showWorkSettings ? 'chevron.up' : 'chevron.down', android: showWorkSettings ? 'expand_less' : 'expand_more' }} size={18} color="#9EB0C2" />
        </Pressable>
        {showWorkSettings ? (
          <>
        <View style={styles.proV3ControlCard}>
          <View style={styles.proV3ControlHeader}>
            <View>
              <Text style={styles.proV3ControlTitle}>Availability window</Text>
              <Text style={styles.proV3ControlSub}>Automatically come off the live list later.</Text>
            </View>
            <Text style={styles.proV3ControlValue}>{duration}</Text>
          </View>
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
        </View>

        <View style={styles.proV3ControlCard}>
          <View style={styles.proV3ControlHeader}>
            <View>
              <Text style={styles.proV3ControlTitle}>Work radius</Text>
              <Text style={styles.proV3ControlSub}>Only receive opportunities inside this distance.</Text>
            </View>
            <Text style={styles.proV3ControlValue}>{radius} mi</Text>
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
        </View>

          </>
        ) : null}

        <Pressable
          style={styles.proV3DetailsToggle}
          onPress={() => setShowPlanning(value => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showPlanning }}
        >
          <View style={styles.proV3DetailsIcon}>
            <AppIcon icon={{ ios: 'square.grid.2x2.fill', android: 'apps' }} size={18} color="#456A82" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.proV3DetailsTitle}>More work tools</Text>
            <Text style={styles.proV3DetailsSub}>Choose a work area or explore route jobs</Text>
          </View>
          <AppIcon icon={{ ios: showPlanning ? 'chevron.up' : 'chevron.down', android: showPlanning ? 'expand_less' : 'expand_more' }} size={18} color="#9EB0C2" />
        </Pressable>
        {showPlanning ? (
          <>
            <View style={styles.radarCard}>
              <Text style={styles.radarEyebrow}>WORK AREA</Text>
              <Text style={styles.radarTitle}>Where would you like to work?</Text>
              <Text style={styles.radarSub}>Select an area to update where customers can find you. These are suggested areas, not live demand figures.</Text>
              {demandAreas.map(area => (
                <Pressable
                  key={area.name}
                  style={styles.radarArea}
                  onPress={() => workDemandArea(area)}
                  disabled={radarBusy === area.name}
                >
                  <View style={styles.proV3AreaIcon}>
                    <AppIcon icon={{ ios: 'location.fill', android: 'location_on' }} size={20} color="#375D79" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.radarAreaName}>{area.name}</Text>
                    <Text style={styles.radarAreaMeta}>Use as my work area</Text>
                  </View>
                  {radarBusy === area.name
                    ? <ActivityIndicator size="small" color={C.blue} />
                    : <AppIcon icon={{ ios: 'arrow.right', android: 'arrow_forward' }} size={16} color="#375D79" />}
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.proV3RouteShortcut} onPress={() => navigate('tradeJobs')}>
              <View style={styles.proV3AreaIcon}>
                <AppIcon icon={{ ios: 'arrow.triangle.branch', android: 'alt_route' }} size={20} color="#375D79" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.proV3RouteShortcutTitle}>Route opportunities</Text>
                <Text style={styles.proV3RouteShortcutSub}>See flexible jobs that could fit your schedule</Text>
              </View>
              <AppIcon icon={{ ios: 'arrow.right', android: 'arrow_forward' }} size={17} color="#375D79" />
            </Pressable>
          </>
        ) : null}

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

  type MarketOfferJob = {
    offerId: string;
    offerStatus: string;
    distance: number;
    eta: number;
    quotedPrice: number | null;
    routePrice: number | null;
    detourMinutes: number | null;
    request: any;
  };

  const [jobs, setJobs] = useState<OfferJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [marketJobs, setMarketJobs] = useState<MarketOfferJob[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(true);

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

    const [{ data: requestRows }, { data: exactLocationRows }] = await Promise.all([
      supabase
        .from('urgent_requests')
        .select(
          'id, trade, issue, urgency, latitude, longitude, status, customer_id, created_at, accepted_tradesperson_id, estimated_arrival_minutes'
        )
        .in('id', requestIds),
      supabase
        .from('urgent_request_locations')
        .select('request_id, latitude, longitude')
        .in('request_id', requestIds),
    ]);

    const exactMap = new Map(
      (exactLocationRows ?? []).map(row => [
        row.request_id,
        { latitude: Number(row.latitude), longitude: Number(row.longitude) },
      ])
    );

    const requestMap = new Map(
      (requestRows ?? []).map(row => [
        row.id,
        {
          ...row,
          exactLocation: exactMap.get(row.id) || null,
        },
      ])
    );

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


  const loadMarketJobs = async (knownUserId?: string) => {
    setLoadingMarket(true);

    const userId =
      knownUserId ||
      (
        await supabase.auth.getUser()
      ).data.user?.id ||
      null;

    if (!userId) {
      setMarketJobs([]);
      setLoadingMarket(false);
      return;
    }

    const { data: offerRows, error: offerError } = await supabase
      .from('job_offers')
      .select('id, job_id, status, distance_miles, eta_minutes, quoted_price, route_price, detour_minutes, offered_at')
      .eq('tradesperson_id', userId)
      .in('status', ['offered', 'accepted'])
      .order('offered_at', { ascending: false });

    if (offerError || !offerRows?.length) {
      setMarketJobs([]);
      setLoadingMarket(false);
      return;
    }

    const jobIds = Array.from(new Set(offerRows.map(row => row.job_id)));

    const [{ data: jobRows }, { data: exactLocationRows }] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, customer_id, trade, issue, job_mode, timing, status, accepted_tradesperson_id, standard_price, route_price, detour_minutes, created_at')
        .in('id', jobIds),
      supabase
        .from('job_locations')
        .select('job_id, latitude, longitude, address_label')
        .in('job_id', jobIds),
    ]);

    const exactMap = new Map(
      (exactLocationRows ?? []).map(row => [
        row.job_id,
        {
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          addressLabel: row.address_label || 'Customer location',
        },
      ])
    );

    const jobMap = new Map(
      (jobRows ?? []).map(row => [
        row.id,
        {
          ...row,
          exactLocation: exactMap.get(row.id) || null,
        },
      ])
    );

    setMarketJobs(
      offerRows
        .map(row => ({
          offerId: row.id,
          offerStatus: row.status,
          distance: Number(row.distance_miles) || 0,
          eta: Number(row.eta_minutes) || 10,
          quotedPrice: row.quoted_price == null ? null : Number(row.quoted_price),
          routePrice: row.route_price == null ? null : Number(row.route_price),
          detourMinutes: row.detour_minutes == null ? null : Number(row.detour_minutes),
          request: jobMap.get(row.job_id),
        }))
        .filter(item => item.request)
    );

    setLoadingMarket(false);
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

  useEffect(() => {
    let offerChannel: any = null;
    let jobChannel: any = null;
    let mounted = true;

    const start = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) {
        setLoadingMarket(false);
        return;
      }

      await loadMarketJobs(user.id);

      offerChannel = supabase
        .channel('market-offers-' + user.id)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'job_offers',
            filter: 'tradesperson_id=eq.' + user.id,
          },
          () => loadMarketJobs(user.id)
        )
        .subscribe();

      jobChannel = supabase
        .channel('market-jobs-' + user.id)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'jobs',
            filter: 'accepted_tradesperson_id=eq.' + user.id,
          },
          () => loadMarketJobs(user.id)
        )
        .subscribe();
    };

    start();

    return () => {
      mounted = false;
      if (offerChannel) supabase.removeChannel(offerChannel);
      if (jobChannel) supabase.removeChannel(jobChannel);
    };
  }, []);


  useEffect(() => {
    const hasActiveTrackingJob = jobs.some(
      job =>
        job.offerStatus === 'accepted' &&
        ['matched', 'en_route', 'arrived'].includes(job.request.status)
    );

    if (!hasActiveTrackingJob) return;

    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !active) return;

      const { data: availability } = await supabase
        .from('trade_availability')
        .select('location_mode')
        .eq('user_id', user.id)
        .single();

      if (availability?.location_mode !== 'live') return;

      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted' || !active) return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 20,
          timeInterval: 8000,
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
  }, [jobs]);

  const respondToOffer = async (job: OfferJob, response: 'accepted' | 'declined') => {
    setBusyId(job.offerId);

    const { data: updatedOffer, error } = await supabase
      .from('urgent_request_offers')
      .update({
        status: response,
        responded_at: new Date().toISOString(),
      })
      .eq('id', job.offerId)
      .eq('status', 'offered')
      .select('id')
      .maybeSingle();

    setBusyId(null);

    // A conditional UPDATE affecting zero rows is not an error in PostgREST.
    // Detect expired/already-accepted offers rather than showing a false success.
    if (error || !updatedOffer) {
      Alert.alert(
        response === 'accepted' ? 'Job no longer available' : 'Could not decline',
        response === 'accepted'
          ? 'Another tradesperson may have accepted this job first.'
          : error?.message || 'This offer is no longer available.'
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

    if (!next || !currentUserId) return;

    setBusyId(job.offerId);
    const { data: updatedRequest, error } = await supabase
      .from('urgent_requests')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', job.request.id)
      .eq('accepted_tradesperson_id', currentUserId)
      .eq('status', current)
      .select('id')
      .maybeSingle();

    setBusyId(null);

    if (error || !updatedRequest) {
      Alert.alert('Could not update job', error?.message || 'The job has changed. Refreshing its latest status.');
      await loadJobs(currentUserId);
      return;
    }

    await loadJobs(currentUserId);
  };

  const openDirections = (job: OfferJob) => {
    const location = job.request.exactLocation;
    if (!location) {
      Alert.alert('Exact location unavailable', 'The exact job location becomes available after the request is accepted.');
      return;
    }

    Linking.openURL(
      'https://maps.google.com/?daddr=' + location.latitude + ',' + location.longitude
    );
  };


  const respondToMarketOffer = async (job: MarketOfferJob, response: 'accepted' | 'declined') => {
    setBusyId(job.offerId);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setBusyId(null);
      return;
    }

    const { data: updatedOffer, error } = await supabase
      .from('job_offers')
      .update({
        status: response,
        responded_at: new Date().toISOString(),
      })
      .eq('id', job.offerId)
      .eq('tradesperson_id', user.id)
      .eq('status', 'offered')
      .select('id, status')
      .maybeSingle();

    setBusyId(null);

    if (error || !updatedOffer) {
      Alert.alert(
        response === 'accepted' ? 'Job no longer available' : 'Could not decline',
        response === 'accepted'
          ? 'Another tradesperson may have accepted this job first.'
          : error?.message || 'Please try again.'
      );
      await loadMarketJobs(user.id);
      return;
    }

    await loadMarketJobs(user.id);
  };

  const advanceMarketJob = async (job: MarketOfferJob) => {
    const current = job.request.status;
    const next =
      current === 'accepted'
        ? 'en_route'
        : current === 'en_route'
          ? 'arrived'
          : current === 'arrived'
            ? 'in_progress'
            : current === 'in_progress'
              ? 'completed'
              : null;

    if (!next || !currentUserId) return;

    setBusyId(job.offerId);

    const { data: updatedJob, error } = await supabase
      .from('jobs')
      .update({
        status: next,
        completed_at: next === 'completed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.request.id)
      .eq('accepted_tradesperson_id', currentUserId)
      .eq('status', current)
      .select('id')
      .maybeSingle();

    setBusyId(null);

    if (error || !updatedJob) {
      Alert.alert('Could not update job', error?.message || 'The job has changed. Refreshing its latest status.');
      await loadMarketJobs(currentUserId);
      return;
    }

    await loadMarketJobs(currentUserId);
  };

  const openMarketDirections = (job: MarketOfferJob) => {
    const location = job.request.exactLocation;
    if (!location) {
      Alert.alert('Location protected', 'The exact customer location becomes available after you accept the job.');
      return;
    }

    Linking.openURL(
      'https://maps.google.com/?daddr=' + location.latitude + ',' + location.longitude
    );
  };

  const active = jobs.filter(job => job.offerStatus === 'accepted');
  const offered = jobs.filter(job => job.offerStatus === 'offered');
  const marketActive = marketJobs.filter(job => job.offerStatus === 'accepted');
  const marketOffered = marketJobs.filter(
    job => job.offerStatus === 'offered' && ['posted', 'offered'].includes(job.request.status)
  );

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

        {marketActive.length ? (
          <>
            <Text style={styles.dispatchTradeSectionTitle}>Scheduled & flexible jobs</Text>
            {marketActive.map(job => (
              <View key={job.offerId} style={styles.marketTradeActiveCard}>
                <View style={styles.dispatchTradeTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.marketTradeMode}>
                      {job.request.job_mode === 'street_run'
                        ? 'STREET RUN'
                        : job.request.job_mode === 'route'
                          ? 'ON MY WAY'
                          : 'BOOKED JOB'}
                    </Text>
                    <Text style={styles.dispatchTradeJobTitle}>{job.request.trade}</Text>
                  </View>
                  <Badge text={marketJobStatusLabel(job.request.status)} green />
                </View>

                <Text style={styles.dispatchTradeIssue}>{job.request.issue}</Text>
                <Text style={styles.marketTradeTiming}>{job.request.timing}</Text>

                <View style={styles.dispatchTradeMetaRow}>
                  <Text style={styles.dispatchTradeMeta}>📍 {job.distance.toFixed(1)} mi away</Text>
                  {job.routePrice != null ? (
                    <Text style={styles.marketTradePrice}>£{job.routePrice}</Text>
                  ) : null}
                </View>

                <View style={styles.dispatchTradeActionRow}>
                  <Pressable style={styles.dispatchTradeDirections} onPress={() => openMarketDirections(job)}>
                    <AppIcon icon={{ ios: 'map.fill', android: 'map' }} size={17} color={C.navy2} />
                    <Text style={styles.dispatchTradeDirectionsText}>Directions</Text>
                  </Pressable>

                  {job.request.status !== 'completed' ? (
                    <Pressable
                      style={[styles.dispatchTradeAdvance, busyId === job.offerId && { opacity: 0.6 }]}
                      onPress={() => advanceMarketJob(job)}
                      disabled={busyId === job.offerId}
                    >
                      <Text style={styles.dispatchTradeAdvanceText}>
                        {job.request.status === 'accepted'
                          ? 'Start journey'
                          : job.request.status === 'en_route'
                            ? "I've arrived"
                            : job.request.status === 'arrived'
                              ? 'Start job'
                              : job.request.status === 'in_progress'
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

        <Text style={styles.dispatchTradeSectionTitle}>Flexible & scheduled offers</Text>

        {loadingMarket ? (
          <View style={styles.tradeEmptyCompact}>
            <ActivityIndicator color={C.green} />
            <Text style={styles.tradeEmptyLargeText}>Checking route and booking offers…</Text>
          </View>
        ) : marketOffered.length ? (
          marketOffered.map(job => (
            <View key={job.offerId} style={styles.marketTradeOfferCard}>
              <View style={styles.dispatchTradeTopRow}>
                <View style={styles.marketTradeOfferIcon}>
                  <AppIcon
                    icon={{ ios: job.request.job_mode === 'normal' ? 'calendar' : 'arrow.triangle.branch', android: job.request.job_mode === 'normal' ? 'event' : 'alt_route' }}
                    size={18}
                    color={C.orange}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.marketTradeMode}>
                    {job.request.job_mode === 'street_run'
                      ? 'STREET RUN'
                      : job.request.job_mode === 'route'
                        ? 'ON MY WAY'
                        : 'SCHEDULED'}
                  </Text>
                  <Text style={styles.dispatchTradeJobTitle}>{job.request.trade}</Text>
                </View>
                {job.routePrice != null ? (
                  <View style={styles.marketTradePayPill}>
                    <Text style={styles.marketTradePay}>£{job.routePrice}</Text>
                    <Text style={styles.marketTradePaySmall}>route price</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.dispatchTradeIssue}>{job.request.issue}</Text>
              <Text style={styles.marketTradeTiming}>{job.request.timing}</Text>

              <View style={styles.dispatchTradeMetaRow}>
                <Text style={styles.dispatchTradeMeta}>📍 approx. {job.distance.toFixed(1)} mi</Text>
                <Text style={styles.dispatchTradeMeta}>
                  {job.detourMinutes != null ? '+' + job.detourMinutes + ' min route' : '~' + job.eta + ' min away'}
                </Text>
              </View>

              <View style={styles.dispatchTradeDecisionRow}>
                <Pressable
                  style={styles.dispatchTradeDecline}
                  onPress={() => respondToMarketOffer(job, 'declined')}
                  disabled={busyId === job.offerId}
                >
                  <Text style={styles.dispatchTradeDeclineText}>Decline</Text>
                </Pressable>
                <Pressable
                  style={[styles.marketTradeAccept, busyId === job.offerId && { opacity: 0.6 }]}
                  onPress={() => respondToMarketOffer(job, 'accepted')}
                  disabled={busyId === job.offerId}
                >
                  {busyId === job.offerId ? (
                    <ActivityIndicator color={C.navy} />
                  ) : (
                    <Text style={styles.marketTradeAcceptText}>Accept job</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.tradeEmptyCompact}>
            <AppIcon icon={{ ios: 'arrow.triangle.branch', android: 'alt_route' }} size={26} color={C.green} />
            <Text style={styles.tradeEmptyLargeTitle}>No flexible offers yet</Text>
            <Text style={styles.tradeEmptyLargeText}>
              On My Way, Street Run and scheduled bookings inside your area will appear here automatically.
            </Text>
          </View>
        )}

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
      <TradeSuppliersMap />
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

    const { data: rows, error } = await supabase
      .from('conversations')
      .select('id, customer_id, customer_display_name, updated_at')
      .eq('tradesperson_id', user.id)
      .order('updated_at', { ascending: false });

    if (error || !rows?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const conversationIds = rows.map(row => row.id);
    const { data: latestMessages } = await supabase
      .from('messages')
      .select('conversation_id, body, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    const latestMap = new Map<string, { body: string; created_at: string }>();

    for (const item of latestMessages ?? []) {
      if (!latestMap.has(item.conversation_id)) latestMap.set(item.conversation_id, item);
    }

    setConversations(
      rows.map(row => {
        const latest = latestMap.get(row.id);

        return {
          id: row.id,
          customerId: row.customer_id,
          customerName: row.customer_display_name || 'Customer',
          lastMessage: latest?.body || 'You are connected — say hello.',
          updatedAt: latest?.created_at || row.updated_at,
        };
      })
    );

    setLoading(false);
  };

  useEffect(() => {
    let channel: any = null;
    let active = true;

    const start = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !active) {
        setLoading(false);
        return;
      }

      await loadInbox();

      channel = supabase
        .channel('trade-conversations-' + user.id)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: 'tradesperson_id=eq.' + user.id,
          },
          () => loadInbox()
        )
        .subscribe();
    };

    start();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!selected) {
      setThread([]);
      return;
    }

    let active = true;
    let channel: any = null;

    const start = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, sender_id, body, created_at')
        .eq('conversation_id', selected.id)
        .order('created_at', { ascending: true });

      if (!active) return;
      setThread((data as TradeLiveMessage[]) ?? []);

      channel = supabase
        .channel('trade-thread-' + selected.id)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: 'conversation_id=eq.' + selected.id,
          },
          payload => {
            const incoming = payload.new as TradeLiveMessage;
            setThread(previous =>
              previous.some(item => item.id === incoming.id)
                ? previous
                : [...previous, incoming]
            );
            loadInbox();
          }
        )
        .subscribe();
    };

    start();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
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

    setThread(current =>
      current.some(item => item.id === data.id) ? current : [...current, data as TradeLiveMessage]
    );

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
  const [bio, setBio] = useState('');
  const [publicPhone, setPublicPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

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
          .select('display_name, primary_trade, avatar_url, bio, public_phone')
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
        setBio(profile.bio || '');
        setPublicPhone(profile.public_phone || '');
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

  const savePublicProfile = async () => {
    const cleanName = displayName.trim();
    const cleanPhone = publicPhone.replace(/\s/g, '');

    if (!cleanName) {
      Alert.alert('Business name needed', 'Add the name customers should see.');
      return;
    }

    if (cleanPhone && !/^07\d{9}$/.test(cleanPhone)) {
      Alert.alert('Check phone number', 'Use a UK mobile number beginning with 07, or leave it blank.');
      return;
    }

    if (!customerCategoryOrder.includes(primaryTrade as TradeCategory)) {
      Alert.alert('Choose your trade', 'Select the main trade customers should find you under.');
      return;
    }

    setSavingProfile(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSavingProfile(false);
      return;
    }

    const { error } = await supabase
      .from('tradesperson_profiles')
      .update({
        display_name: cleanName,
        primary_trade: primaryTrade,
        public_phone: cleanPhone || null,
        bio: bio.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    setSavingProfile(false);

    if (error) {
      Alert.alert('Could not save profile', error.message);
      return;
    }

    Alert.alert('Profile updated', 'Customers will now see your latest public details.');
  };

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

        <View style={styles.tradeEditCard}>
          <View style={styles.tradeEditHeader}>
            <View style={styles.tradeEditIcon}>
              <AppIcon icon={{ ios: 'person.crop.rectangle', android: 'badge' }} size={20} color={C.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tradeEditTitle}>Public profile</Text>
              <Text style={styles.tradeEditSub}>These are the details customers see in Explore and after a match.</Text>
            </View>
          </View>

          <Text style={styles.tradeEditLabel}>Business / display name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            style={styles.tradeEditInput}
            placeholder="e.g. AJ Plumbing"
            placeholderTextColor="#71877B"
            maxLength={80}
          />

          <Text style={styles.tradeEditLabel}>Main trade</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tradeEditTradeRow}>
            {customerCategoryOrder.map(item => (
              <Pressable
                key={item}
                style={[styles.tradeEditChip, primaryTrade === item && styles.tradeEditChipActive]}
                onPress={() => setPrimaryTrade(item)}
              >
                <Text style={[styles.tradeEditChipText, primaryTrade === item && styles.tradeEditChipTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.tradeEditLabel}>Public phone (optional)</Text>
          <TextInput
            value={publicPhone}
            onChangeText={setPublicPhone}
            style={styles.tradeEditInput}
            placeholder="07..."
            placeholderTextColor="#71877B"
            keyboardType="phone-pad"
            maxLength={11}
          />

          <Text style={styles.tradeEditLabel}>About your business</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            style={[styles.tradeEditInput, styles.tradeEditBio]}
            placeholder="What do you specialise in? What areas do you cover?"
            placeholderTextColor="#71877B"
            multiline
            maxLength={600}
          />

          <Pressable
            style={[styles.tradeEditSave, savingProfile && { opacity: 0.5 }]}
            onPress={savePublicProfile}
            disabled={savingProfile}
          >
            {savingProfile ? (
              <ActivityIndicator color={C.navy} />
            ) : (
              <>
                <Text style={styles.tradeEditSaveText}>Save public profile</Text>
                <AppIcon icon={{ ios: 'checkmark', android: 'check' }} size={15} color={C.navy} />
              </>
            )}
          </Pressable>
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

        {['Verification', 'Services & prices', 'Notifications', 'Payouts'].map(item => (
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
  safe: { flex: 1, backgroundColor: C.canvas },
  screen: { flex: 1, backgroundColor: C.canvas },
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
  tradeNav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 82, backgroundColor: C.homeInk, borderTopWidth: 1, borderTopColor: '#314559', flexDirection: 'row', paddingBottom: 9, paddingTop: 4 },
  tradeNavIconActive: { backgroundColor: '#C86B50', width: 39, height: 34, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 58 },
  navIcon: { fontSize: 24, color: '#7C8795' },
  navLabel: { fontSize: 10, color: '#AEBACA', marginTop: 4, fontWeight: '700' },
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
  plainPage: { paddingHorizontal: 20, paddingTop: 22, backgroundColor: C.canvas },
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
  largeBlueButton: { minHeight: 52, borderRadius: 16, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', marginTop: 22, paddingHorizontal: 20 },
  largeBlueText: { color: C.white, fontSize: 13, fontWeight: '800', letterSpacing: 0.1 },
  pageTitle: { color: C.text, fontFamily: DISPLAY_FONT, fontWeight: '800', fontSize: 32, letterSpacing: -1.1 },
  pageSub: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 22 },
  emptyCard: { backgroundColor: C.white, borderRadius: 24, paddingHorizontal: 26, paddingVertical: 34, alignItems: 'center', marginTop: 24, borderWidth: 1, borderColor: C.line, shadowColor: '#27291F', shadowOpacity: 0.04, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  emptyIcon: { fontSize: 34, color: C.blue },
  emptyTitle: { fontFamily: DISPLAY_FONT, fontSize: 21, fontWeight: '800', color: C.text, marginTop: 12, letterSpacing: -0.45 },
  emptyBody: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 7, maxWidth: 270 },
  requestCard: { borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, padding: 18, marginBottom: 12, shadowColor: '#22241E', shadowOpacity: 0.035, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  requestTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  requestTrade: { fontFamily: DISPLAY_FONT, fontWeight: '800', color: C.text, fontSize: 17, letterSpacing: -0.3 },
  requestIssue: { color: C.text, fontSize: 14, lineHeight: 20, marginTop: 11, marginBottom: 5 },
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
  messagesPage: { flex: 1, backgroundColor: C.canvas, paddingHorizontal: 20, paddingTop: 22 },
  messagesTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  messagesTitle: { color: C.text, fontFamily: DISPLAY_FONT, fontSize: 32, fontWeight: '800', letterSpacing: -1.1 },
  messagesSub: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
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
  messagesEmptyIcon: { width: 66, height: 66, borderRadius: 22, backgroundColor: C.cyan, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  messagesEmptyTitle: { color: C.text, fontFamily: DISPLAY_FONT, fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  messagesEmptySub: { color: C.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7, maxWidth: 280 },
  messagesBrowseButton: { height: 50, borderRadius: 16, backgroundColor: C.navy, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
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
  customerProfileCard: { backgroundColor: '#12362C', borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 18, borderWidth: 1, borderColor: '#275044' },
  customerAvatar: { width: 58, height: 58, borderRadius: 20, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  customerAvatarText: { color: C.navy, fontFamily: DISPLAY_FONT, fontWeight: '900', fontSize: 23 },
  customerName: { fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: '800', color: C.white, letterSpacing: -0.4 },
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
    minHeight: 74,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: '#E2DED2',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 9,
  },
  settingsLabel: { fontFamily: DISPLAY_FONT, fontWeight: '700', color: C.text, fontSize: 14, lineHeight: 18 },
  settingsSubText: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 4, maxWidth: 270 },
  settingsChevron: { fontSize: 23, color: '#96998F', marginLeft: 12 },
  proSwitchCard: { backgroundColor: C.navy2, borderRadius: 22, padding: 20, marginTop: 22, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#394234' },
  proSwitchTitle: { color: C.white, fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  proSwitchSub: { color: '#C3C9BC', fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 260 },
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
  tradeSectionTitle: { color: C.white, fontSize: 20, fontWeight: '900', flex: 1 },
  tradeLink: { color: '#F2A78E', fontWeight: '800' },
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
  signOutButton: { height: 50, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  signOutText: { color: C.red, fontWeight: '900' },

  photoPicked: { width: 120, height: 105, borderRadius: 15 },
  tradeEmptyCard: { backgroundColor: '#1D3042', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#354C60' },
  tradeEmptyTitle: { color: C.white, fontSize: 14, fontWeight: '900' },
  tradeEmptyText: { color: '#B0BECC', fontSize: 11, lineHeight: 17, marginTop: 6 },
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

  requestCardPressable: {
    borderWidth: 1,
    borderColor: C.line,
  },
  requestCardPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.995 }],
  },
  requestStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  requestTapHint: {
    marginTop: 12,
    fontSize: 10,
    fontWeight: '800',
    color: C.blue,
  },
  requestDetailPage: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    backgroundColor: C.white,
  },
  requestDetailHeader: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestDetailHeaderTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: C.navy2,
  },
  requestDetailLoading: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  requestDetailStatusCard: {
    marginTop: 8,
    padding: 18,
    borderRadius: 22,
    backgroundColor: C.pale,
  },
  requestDetailStatusTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  requestDetailTrade: {
    fontSize: 24,
    fontWeight: '900',
    color: C.navy2,
  },
  requestDetailUrgency: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '800',
    color: C.blue,
  },
  requestDetailIssue: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 22,
    color: C.text,
  },
  requestDemoNotice: {
    marginTop: 12,
    padding: 13,
    borderRadius: 15,
    backgroundColor: '#EEF6FF',
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  requestDemoNoticeText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
    color: C.muted,
  },
  requestDetailSectionTitle: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '900',
    color: C.navy2,
  },
  requestDetailMap: {
    height: 210,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: C.pale,
  },
  requestDetailTradeCard: {
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestDetailAvatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: C.pale,
  },
  requestDetailName: {
    fontSize: 16,
    fontWeight: '900',
    color: C.navy2,
    flexShrink: 1,
  },
  requestDetailRole: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
  },
  requestDetailMeta: {
    marginTop: 5,
    fontSize: 10,
    color: C.text,
  },
  requestDetailActions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  requestDetailSecondary: {
    height: 46,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: C.pale,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestDetailSecondaryText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.navy2,
  },
  requestDetailPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestDetailPrimaryText: {
    fontSize: 12,
    fontWeight: '900',
    color: C.white,
  },
  requestDetailSearchingCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#F5F9FD',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestDetailSearchingTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: C.navy2,
  },
  requestDetailSearchingText: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 15,
    color: C.muted,
  },
  requestDetailCancel: {
    marginTop: 18,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D9E0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestDetailCancelText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.red,
  },

  customerAccountType: {
    color: '#C6CBBF',
    fontSize: 12,
    marginTop: 3,
  },
  v2HomeScreen: {
    flex: 1,
    backgroundColor: C.canvas,
  },
  v2HomeContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 34,
  },
  v2TopBar: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v2BrandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  v2BrandMark: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: C.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  v2Brand: {
    color: C.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  v2BrandSub: {
    color: C.muted,
    fontSize: 9,
    marginTop: 1,
  },
  v2LocationPill: {
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  v2LocationText: {
    color: C.text,
    fontSize: 11,
    fontWeight: '700',
  },
  v2HeroCard: {
    backgroundColor: C.navy,
    borderRadius: 28,
    paddingHorizontal: 21,
    paddingTop: 20,
    paddingBottom: 18,
    marginTop: 10,
    overflow: 'hidden',
  },
  v2HeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v2Eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  v2EyebrowDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.cyan,
  },
  v2EyebrowText: {
    color: '#CFD4C8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  v2HeroMiniMark: {
    width: 34,
    height: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  v2HeroMiniLine: {
    width: 25,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#5B6255',
  },
  v2HeroTitle: {
    color: C.white,
    fontFamily: DISPLAY_FONT,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -1.25,
    marginTop: 18,
  },
  v2HeroBody: {
    color: '#BFC5B8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
    maxWidth: 315,
  },
  v2Search: {
    height: 58,
    borderRadius: 18,
    backgroundColor: C.white,
    marginTop: 20,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  v2SearchIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: C.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v2SearchText: {
    flex: 1,
    marginLeft: 11,
    color: '#676C63',
    fontSize: 14,
    fontWeight: '600',
  },
  v2SearchGo: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: C.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v2TrustRow: {
    marginTop: 17,
    flexDirection: 'row',
    alignItems: 'center',
  },
  v2TrustItem: {
    flex: 1,
  },
  v2TrustValue: {
    color: C.cyan,
    fontFamily: DISPLAY_FONT,
    fontSize: 14,
    fontWeight: '800',
  },
  v2TrustLabel: {
    color: '#9FA79A',
    fontSize: 9,
    marginTop: 2,
  },
  v2TrustDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#3B4037',
    marginHorizontal: 14,
  },
  v2SectionHead: {
    marginTop: 27,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  v2SectionEyebrow: {
    color: C.blue,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  v2SectionTitle: {
    color: C.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.65,
  },
  v2SectionLink: {
    color: C.blue,
    fontSize: 11,
    fontWeight: '800',
    paddingBottom: 2,
  },
  v2CategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  v2CategoryTile: {
    width: '25%',
    paddingHorizontal: 4,
    marginBottom: 9,
    alignItems: 'center',
  },
  v2CategoryTileActive: {},
  v2CategoryIcon: {
    width: '100%',
    height: 61,
    borderRadius: 17,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v2CategoryIconActive: {
    backgroundColor: C.cyan,
    borderColor: C.cyan,
  },
  v2CategoryLabel: {
    color: C.text,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 7,
  },
  v2UrgentCard: {
    marginTop: 13,
    borderRadius: 24,
    backgroundColor: C.clay,
    padding: 19,
    flexDirection: 'row',
    alignItems: 'center',
  },
  v2UrgentLeft: {
    flex: 1,
    paddingRight: 12,
  },
  v2UrgentTag: {
    alignSelf: 'flex-start',
    minHeight: 23,
    borderRadius: 12,
    backgroundColor: 'rgba(24,27,23,0.13)',
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  v2UrgentTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.navy,
  },
  v2UrgentTagText: {
    color: C.navy,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  v2UrgentTitle: {
    color: '#201A17',
    fontFamily: DISPLAY_FONT,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 10,
  },
  v2UrgentBody: {
    color: '#56352A',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    maxWidth: 275,
  },
  v2UrgentAction: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: C.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v2NearbyRow: {
    paddingRight: 8,
    paddingBottom: 4,
  },
  v2NearbyCard: {
    width: 168,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 22,
    padding: 12,
    marginRight: 10,
  },
  v2NearbyImageWrap: {
    position: 'relative',
    marginBottom: 11,
  },
  v2NearbyImage: {
    width: '100%',
    height: 112,
    borderRadius: 16,
    backgroundColor: C.pale,
  },
  v2OnlineDot: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: C.green,
    borderWidth: 2,
    borderColor: C.white,
  },
  v2NearbyName: {
    color: C.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  v2NearbyRole: {
    color: C.muted,
    fontSize: 10,
    marginTop: 2,
  },
  v2NearbyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
  },
  v2NearbyRating: {
    color: C.text,
    fontSize: 10,
    fontWeight: '800',
  },
  v2NearbyDotText: {
    color: '#AAA99F',
    marginHorizontal: 5,
    fontSize: 9,
  },
  v2NearbyDistance: {
    color: C.muted,
    fontSize: 10,
  },
  v2NearbyFooter: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v2NearbyEta: {
    color: C.blue,
    fontSize: 10,
    fontWeight: '800',
  },
  v2NearbyArrow: {
    width: 29,
    height: 29,
    borderRadius: 10,
    backgroundColor: C.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v2MapCallout: {
    marginTop: 18,
    minHeight: 78,
    borderRadius: 20,
    backgroundColor: C.stone,
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  v2MapGlyph: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  v2MapCalloutTitle: {
    color: C.text,
    fontFamily: DISPLAY_FONT,
    fontSize: 14,
    fontWeight: '800',
  },
  v2MapCalloutSub: {
    color: C.muted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
    maxWidth: 240,
  },
  v2Nav: { minHeight: 76, backgroundColor: C.homeInk, borderTopWidth: 1, borderTopColor: '#2B3848', flexDirection: 'row', paddingTop: 7, paddingBottom: 6 },
  v2NavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v2NavIconWrap: {
    width: 34,
    height: 31,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v2NavIconWrapActive: {
    backgroundColor: C.orange,
  },
  v2NavLabel: { color: '#A8B3C0', fontSize: 9, fontWeight: '600', marginTop: 2 },
  v2NavLabelActive: {
    color: C.white,
    fontWeight: '800',
  },

  v2SettingIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.pale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  marketHome: { flex: 1, backgroundColor: C.homeInk },
  marketActionPair: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 25 },
  marketActionCard: { width: '48.5%', minHeight: 145, borderRadius: 16, padding: 14, justifyContent: 'space-between' },
  marketActionUrgent: { backgroundColor: '#B9573D' },
  marketActionFlexible: { backgroundColor: '#DCE7ED' },
  marketActionTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  marketActionUrgentIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#A34A33', alignItems: 'center', justifyContent: 'center' },
  marketActionFlexibleIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#C9D9E3', alignItems: 'center', justifyContent: 'center' },
  marketActionUrgentTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: -0.35 },
  marketActionUrgentSub: { color: '#FFE3DB', fontSize: 11, lineHeight: 16, marginTop: 5 },
  marketActionFlexibleTitle: { color: '#193247', fontSize: 17, fontWeight: '900', letterSpacing: -0.35 },
  marketActionFlexibleSub: { color: '#4E6374', fontSize: 11, lineHeight: 16, marginTop: 5 },
  marketExploreCard: { marginTop: 18, minHeight: 82, borderRadius: 16, backgroundColor: '#E0E8EC', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  marketExploreIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#CADAE3', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  marketExploreTitle: { color: '#1A3244', fontWeight: '900', fontSize: 15 },
  marketExploreSub: { color: '#586D7F', fontSize: 11, marginTop: 4 },
  marketExploreArrow: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#CEDBE4', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  marketHomeContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 34 },
  marketHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  marketGreeting: { color: '#F9F6EF', fontFamily: DISPLAY_FONT, fontSize: 27, fontWeight: '800', letterSpacing: -0.7 },
  marketGreetingSub: { color: '#B6C0CD', fontSize: 13, marginTop: 5 },
  marketAccountButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, borderColor: '#405063', backgroundColor: C.homeSurface, alignItems: 'center', justifyContent: 'center' },
  marketAddressCard: { minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: '#33485C', backgroundColor: C.homeSurface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, marginBottom: 12 },
  marketAddressIcon: { width: 37, height: 37, borderRadius: 11, backgroundColor: '#2E455C', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  marketAddressEyebrow: { color: '#9FB1C3', fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  marketAddressText: { color: C.white, fontSize: 15, fontWeight: '800', marginTop: 3, maxWidth: 245 },
  marketSearchCard: { minHeight: 88, backgroundColor: '#F9F6EF', borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12 },
  marketSearchIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EEE4D7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  marketSearchTitle: { color: '#182632', fontSize: 18, fontWeight: '900', letterSpacing: -0.35 },
  marketSearchSub: { color: '#69727D', fontSize: 12, lineHeight: 16, marginTop: 4 },
  marketSearchArrow: { width: 39, height: 39, borderRadius: 12, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', marginLeft: 9 },
  marketUrgentCard: { minHeight: 96, borderRadius: 17, backgroundColor: '#B9543A', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginBottom: 26 },
  marketUrgentIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(17,28,41,0.19)', alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  marketUrgentEyebrow: { color: '#FFE3D8', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  marketUrgentTitle: { color: C.white, fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: '800', marginTop: 2 },
  marketUrgentSub: { color: '#FFE6DC', fontSize: 11, lineHeight: 16, marginTop: 3, maxWidth: 230 },
  marketSectionHead: { marginBottom: 12 },
  marketSectionTitle: { color: '#F7F2EA', fontFamily: DISPLAY_FONT, fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  marketSectionSub: { color: '#B4BFCC', fontSize: 12, lineHeight: 17, marginTop: 5 },
  marketCategoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  marketCategoryCard: { width: '48.5%', minHeight: 137, borderRadius: 15, backgroundColor: C.homeStone, borderWidth: 1, borderColor: '#DDD6CA', marginBottom: 10, padding: 13, justifyContent: 'space-between' },
  marketCategoryCardAlt: { backgroundColor: '#E6EAED', borderColor: '#D2DBE1' },
  marketCategoryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  marketCategoryIndex: { color: '#A4ACB5', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  marketCategoryFoot: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  marketCategoryIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#F1DDCF', alignItems: 'center', justifyContent: 'center' },
  marketCategoryTitle: { color: '#1A2835', fontFamily: DISPLAY_FONT, fontSize: 17, fontWeight: '800', marginTop: 8, letterSpacing: -0.3 },
  marketCategorySub: { flex: 1, color: '#64717E', fontSize: 11, lineHeight: 15, marginTop: 3 },
  marketCategoryGo: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#DED9D1', alignItems: 'center', justifyContent: 'center', marginLeft: 5 },
  marketMoreServices: { minHeight: 68, borderRadius: 15, backgroundColor: '#EEE9E0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, marginTop: 2 },
  marketMoreIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#DEE5EB', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  marketMoreTitle: { color: C.text, fontSize: 14, fontWeight: '800' },
  marketMoreSub: { color: C.muted, fontSize: 10, marginTop: 2 },
  marketNearbyHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 },
  marketSeeAll: { color: '#EFA887', fontSize: 12, fontWeight: '800', paddingBottom: 2 },
  marketNearbyRow: { paddingRight: 18 },
  marketProCard: { width: 166, borderRadius: 22, backgroundColor: '#F7F3E8', marginRight: 10, padding: 10, overflow: 'hidden' },
  marketProImage: { width: '100%', height: 108, borderRadius: 16, marginBottom: 9 },
  marketProAvailable: { position: 'absolute', top: 18, left: 17, borderRadius: 11, backgroundColor: '#E2F3E8', paddingHorizontal: 7, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' },
  marketProDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, marginRight: 4 },
  marketProAvailableText: { color: C.green, fontSize: 8, fontWeight: '900' },
  marketProName: { color: C.text, fontSize: 14, fontWeight: '900' },
  marketProRole: { color: C.muted, fontSize: 10, marginTop: 2 },
  marketProMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  marketProMetaStrong: { color: C.text, fontSize: 10, fontWeight: '900', marginRight: 8 },
  marketProMetaText: { color: C.muted, fontSize: 9, marginRight: 8 },
  marketTrustCard: { minHeight: 78, borderRadius: 15, borderWidth: 1, borderColor: '#33475B', backgroundColor: C.homeSurface, marginTop: 13, padding: 13, flexDirection: 'row', alignItems: 'center' },
  marketTrustIcon: { width: 43, height: 43, borderRadius: 12, backgroundColor: '#DDE7EF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  marketTrustTitle: { color: C.white, fontSize: 14, fontWeight: '800' },
  marketTrustSub: { color: '#B1BFCE', fontSize: 11, lineHeight: 16, marginTop: 4 },
  marketFlowRoot: { flex: 1, justifyContent: 'flex-end' },
  marketFlowBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,15,11,0.64)' },
  marketFlowSheet: { maxHeight: '82%', minHeight: '58%', backgroundColor: '#F8F5ED', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28 },
  marketFlowHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#C9C5BA', alignSelf: 'center', marginBottom: 16 },
  marketFlowHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  marketFlowStep: { color: C.orange, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  marketFlowTitle: { color: C.text, fontFamily: DISPLAY_FONT, fontSize: 25, fontWeight: '800', letterSpacing: -0.7, marginTop: 3 },
  marketFlowClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E9E5D9', alignItems: 'center', justifyContent: 'center' },
  marketFlowProgress: { flexDirection: 'row', gap: 5, marginTop: 15, marginBottom: 14 },
  marketFlowProgressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#DDD8CB' },
  marketFlowProgressBarActive: { backgroundColor: C.blue },
  marketFlowList: { maxHeight: 520 },
  marketFlowRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E4E0D6' },
  marketFlowRowIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#E8EEE7', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  marketFlowRowTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  marketFlowRowSub: { color: C.muted, fontSize: 10, marginTop: 2 },
  marketFlowBackLink: { alignSelf: 'flex-start', minHeight: 36, borderRadius: 12, backgroundColor: '#E8EEE7', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginBottom: 5 },
  marketFlowBackText: { color: C.blue, fontSize: 11, fontWeight: '800', marginLeft: 3 },
  marketFlowServiceRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E4E0D6' },
  marketFlowServiceText: { flex: 1, color: C.text, fontSize: 15, fontWeight: '600' },
  marketTimingRow: { minHeight: 75, borderRadius: 17, borderWidth: 1, borderColor: '#DDD8CC', backgroundColor: '#FFFDF8', paddingHorizontal: 13, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  marketTimingRowActive: { borderColor: C.blue, backgroundColor: '#ECF1E9' },
  marketRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#A6A89F', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  marketRadioActive: { borderColor: C.blue },
  marketRadioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.blue },
  marketTimingTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  marketTimingSub: { color: C.muted, fontSize: 10, lineHeight: 14, marginTop: 2 },
  marketUrgentMini: { borderRadius: 9, backgroundColor: '#FFE0D4', paddingHorizontal: 7, paddingVertical: 4 },
  marketUrgentMiniText: { color: C.orange, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  marketContinue: { minHeight: 55, borderRadius: 14, backgroundColor: C.orange, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  marketContinueDisabled: { opacity: 0.38 },
  marketContinueText: { color: C.white, fontSize: 13, fontWeight: '900' },

  tradePageV3: { paddingHorizontal: 18, paddingTop: 15, paddingBottom: 112, backgroundColor: C.homeInk },
  proV3DetailsToggle: { minHeight: 66, borderRadius: 15, backgroundColor: '#1D3042', borderWidth: 1, borderColor: '#354C60', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 11, marginBottom: 11 },
  proV3DetailsIcon: { width: 37, height: 37, borderRadius: 11, backgroundColor: '#DEE8EF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  proV3DetailsTitle: { color: '#F9F6EF', fontSize: 14, fontWeight: '900' },
  proV3DetailsSub: { color: '#ABBDCC', fontSize: 11, marginTop: 4 },
  proV3AreaIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#DDE7EC', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  proV3RouteShortcut: { minHeight: 71, borderRadius: 15, backgroundColor: '#E0E9EE', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, marginBottom: 14 },
  proV3RouteShortcutTitle: { color: '#1B3448', fontSize: 14, fontWeight: '900' },
  proV3RouteShortcutSub: { color: '#607788', fontSize: 11, marginTop: 4 },
  proV3Header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
  proV3Eyebrow: { color: '#F2A78E', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  proV3Hello: { color: '#F9F6EF', fontFamily: DISPLAY_FONT, fontSize: 28, fontWeight: '800', letterSpacing: -0.7, marginTop: 3 },
  proV3Sub: { color: '#B5C0CD', fontSize: 12, marginTop: 5 },
  proV3CustomerButton: { width: 43, height: 43, borderRadius: 13, backgroundColor: '#203247', borderWidth: 1, borderColor: '#344B60', alignItems: 'center', justifyContent: 'center' },
  proV3ProfileCard: { minHeight: 87, borderRadius: 16, backgroundColor: '#1D3042', borderWidth: 1, borderColor: '#354C60', padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 11 },
  proV3Avatar: { width: 52, height: 52, borderRadius: 14, marginRight: 12 },
  proV3AvatarFallback: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#2D4961', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  proV3AvatarFallbackText: { color: C.white, fontSize: 21, fontWeight: '900' },
  proV3ProfileName: { color: C.white, fontSize: 16, fontWeight: '900' },
  proV3ProfileTrade: { color: '#B2C0CD', fontSize: 11, marginTop: 3 },
  proV3ProgressTrack: { height: 4, borderRadius: 2, backgroundColor: '#3B5063', marginTop: 8, overflow: 'hidden' },
  proV3ProgressFill: { height: 4, borderRadius: 2, backgroundColor: '#E5A080' },
  proV3Completion: { color: '#A8B8C9', fontSize: 10, marginTop: 6, fontWeight: '700' },
  proV3Availability: { minHeight: 88, borderRadius: 16, backgroundColor: '#1D3042', borderWidth: 1, borderColor: '#354C60', padding: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  proV3AvailabilityLive: { backgroundColor: '#DEEAEF', borderColor: '#DEEAEF' },
  proV3AvailabilityIcon: { width: 43, height: 43, borderRadius: 12, backgroundColor: 'rgba(116,148,177,0.13)', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  proV3AvailabilityTitle: { color: C.white, fontSize: 15, fontWeight: '900' },
  proV3AvailabilitySub: { color: '#B2C1CE', fontSize: 11, lineHeight: 16, marginTop: 4, paddingRight: 6 },
  proV3ControlCard: { borderRadius: 16, backgroundColor: '#1D3042', borderWidth: 1, borderColor: '#354C60', padding: 14, marginBottom: 10 },
  proV3ControlHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 11 },
  proV3ControlTitle: { color: C.white, fontSize: 14, fontWeight: '800' },
  proV3ControlSub: { color: '#B0BECC', fontSize: 11, lineHeight: 15, marginTop: 3, maxWidth: 235 },
  proV3ControlValue: { color: '#F2AE93', fontSize: 12, fontWeight: '900' },
  proV3QuickGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 12 },
  proV3QuickCard: { width: '31.5%', minHeight: 105, borderRadius: 15, backgroundColor: '#F4EFE7', padding: 12 },
  proV3QuickIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#E4DED4', alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  proV3QuickValue: { color: '#1B2936', fontSize: 15, fontWeight: '900', letterSpacing: -0.25 },
  proV3QuickLabel: { color: '#667480', fontSize: 10, lineHeight: 14, marginTop: 4 },

  mapIntentCard: { minHeight: 58, borderRadius: 17, backgroundColor: '#F7F3E8', borderWidth: 1, borderColor: '#E1DCCF', marginBottom: 10, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' },
  mapIntentIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFE4D8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  mapIntentLabel: { color: C.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  mapIntentText: { color: C.text, fontSize: 13, fontWeight: '800', marginTop: 2, maxWidth: 210 },
  mapIntentTiming: { borderRadius: 10, backgroundColor: '#E7EFE7', paddingHorizontal: 8, paddingVertical: 6 },
  mapIntentTimingText: { color: C.blue, fontSize: 9, fontWeight: '900' },

  routeHomeCard: { minHeight: 160, borderRadius: 17, backgroundColor: C.homeSlate, padding: 16, marginBottom: 13, overflow: 'hidden', borderWidth: 1, borderColor: '#C5D2DB' },
  routeHomeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeHomeBadge: { minHeight: 28, borderRadius: 8, backgroundColor: '#C3D3DF', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeHomeBadgeText: { color: '#203748', fontSize: 9, fontWeight: '900', letterSpacing: 1.0 },
  routeHomeSaving: { color: '#315A74', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  routeHomeTitle: { color: '#172E40', fontFamily: DISPLAY_FONT, fontSize: 23, fontWeight: '800', letterSpacing: -0.6, marginTop: 14, maxWidth: 315 },
  routeHomeSub: { color: '#526776', fontSize: 11, lineHeight: 17, marginTop: 6, maxWidth: 315 },
  routeHomeFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  routeMiniPath: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  routeMiniDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#355F79' },
  routeMiniLine: { width: 16, height: 1.5, backgroundColor: '#819CAA' },
  routeHomeAction: { flex: 1, color: '#1B3549', fontSize: 11, fontWeight: '900' },

  routeScreen: { flex: 1, backgroundColor: C.canvas },
  routeScreenContent: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 35 },
  routeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  routeBack: { width: 40, height: 40, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  routeEyebrow: { color: C.orange, fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  routeTitle: { color: C.text, fontFamily: DISPLAY_FONT, fontSize: 29, fontWeight: '800', letterSpacing: -0.8 },
  routeSavePill: { borderRadius: 14, backgroundColor: C.lime, paddingHorizontal: 10, paddingVertical: 7 },
  routeSavePillText: { color: C.navy, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  routeExplainCard: { borderRadius: 24, backgroundColor: '#071C16', padding: 17, marginBottom: 22 },
  routeExplainIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#12362C', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  routeExplainTitle: { color: C.white, fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  routeExplainText: { color: '#9BA9A0', fontSize: 11, lineHeight: 16, marginTop: 6 },
  routeExplainSteps: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#24473C' },
  routeExplainStep: { color: '#C7D0C9', fontSize: 8, fontWeight: '700', maxWidth: '31%' },
  routeSectionLabel: { color: C.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.35, marginBottom: 9, marginTop: 2 },
  routeTradeRow: { paddingRight: 10, paddingBottom: 9 },
  routeTradeChip: { minHeight: 38, borderRadius: 19, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  routeTradeChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  routeTradeChipText: { color: C.text, fontSize: 10, fontWeight: '800' },
  routeTradeChipTextActive: { color: C.white },
  routeServiceRow: { paddingRight: 10, paddingBottom: 18 },
  routeServiceChip: { minHeight: 34, borderRadius: 12, backgroundColor: '#EAE6DB', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  routeServiceChipActive: { backgroundColor: '#DDE9DF' },
  routeServiceChipText: { color: C.muted, fontSize: 9, fontWeight: '700' },
  routeServiceChipTextActive: { color: C.blue, fontWeight: '900' },
  routeDeadlineRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 23 },
  routeDeadline: { width: '31.5%', minHeight: 52, borderRadius: 16, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  routeDeadlineActive: { backgroundColor: C.lime, borderColor: C.lime },
  routeDeadlineText: { color: C.muted, fontSize: 10, fontWeight: '800' },
  routeDeadlineTextActive: { color: C.navy },
  routeMatchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  routeMatchTitle: { color: C.text, fontFamily: DISPLAY_FONT, fontSize: 20, fontWeight: '800' },
  routeMatchSub: { color: C.muted, fontSize: 9, marginTop: 2 },
  routeMatchCount: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#E3EADD', alignItems: 'center', justifyContent: 'center' },
  routeMatchCountText: { color: C.blue, fontSize: 11, fontWeight: '900' },
  routeSlotCard: { borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, padding: 13, marginBottom: 10 },
  routeSlotCardActive: { borderColor: C.green, borderWidth: 2, backgroundColor: '#FAFCF8' },
  routeSlotTop: { flexDirection: 'row', alignItems: 'center' },
  routeSlotAvatar: { width: 48, height: 48, borderRadius: 15, marginRight: 10 },
  routeSlotName: { color: C.text, fontSize: 14, fontWeight: '900' },
  routeSlotMeta: { color: C.muted, fontSize: 9, marginTop: 3 },
  routeSlotSaving: { borderRadius: 10, backgroundColor: '#E6F5E8', paddingHorizontal: 7, paddingVertical: 5 },
  routeSlotSavingText: { color: C.green, fontSize: 8, fontWeight: '900' },
  routeSlotJourney: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1EEE5', borderRadius: 15, padding: 10, marginTop: 12 },
  routeSlotJourneyItem: { flex: 1 },
  routeSlotJourneyLabel: { color: C.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  routeSlotJourneyValue: { color: C.text, fontSize: 10, fontWeight: '800', marginTop: 2 },
  routeSlotDivider: { width: 1, height: 28, backgroundColor: '#D9D4C8', marginHorizontal: 10 },
  routePriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10 },
  routeWasPrice: { color: '#99998F', fontSize: 9, textDecorationLine: 'line-through', marginRight: 8 },
  routePrice: { color: C.text, fontSize: 19, fontWeight: '900' },
  routeReserveButton: { minHeight: 58, borderRadius: 18, backgroundColor: C.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 5 },
  routeReserveText: { color: C.navy, fontSize: 12, fontWeight: '900' },
  routeFootnote: { color: C.muted, fontSize: 8, lineHeight: 12, textAlign: 'center', marginTop: 10, paddingHorizontal: 20 },
  routeNoMatch: { borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, padding: 18, alignItems: 'center' },
  routeNoMatchTitle: { color: C.text, fontSize: 15, fontWeight: '900' },
  routeNoMatchText: { color: C.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 4 },

  relayCard: { borderRadius: 22, backgroundColor: '#071C16', padding: 15, marginTop: 14, marginBottom: 10 },
  relayHeader: { flexDirection: 'row', alignItems: 'center' },
  relayIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#12362C', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  relayEyebrow: { color: C.orange, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  relayTitle: { color: C.white, fontSize: 14, fontWeight: '900', marginTop: 2 },
  relayText: { color: '#91A198', fontSize: 9, lineHeight: 14, marginTop: 10 },
  relayOptions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 6 },
  relayOption: { minHeight: 36, borderRadius: 13, backgroundColor: '#12362C', borderWidth: 1, borderColor: '#285044', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  relayOptionText: { color: C.white, fontSize: 9, fontWeight: '800' },

  radarCard: { borderRadius: 16, backgroundColor: '#F4EFE7', padding: 14, marginBottom: 11 },
  radarTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  radarEyebrow: { color: '#B85C42', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  radarTitle: { color: '#1B2936', fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: '800', marginTop: 5 },
  radarSub: { color: '#67727F', fontSize: 11, lineHeight: 16, marginTop: 5, marginBottom: 12 },
  radarPulse: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E2EFDE', alignItems: 'center', justifyContent: 'center' },
  radarPulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.green },
  radarArea: { minHeight: 61, borderRadius: 12, backgroundColor: '#FFFCF6', borderWidth: 1, borderColor: '#E1DBD1', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  radarAreaCount: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#E8EEE7', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  radarAreaCountValue: { color: C.blue, fontSize: 16, fontWeight: '900' },
  radarAreaCountLabel: { color: C.muted, fontSize: 7, fontWeight: '700' },
  radarAreaName: { color: '#1E3447', fontSize: 12, fontWeight: '900' },
  radarAreaMeta: { color: '#657586', fontSize: 10, marginTop: 4 },
  radarAreaAction: { minWidth: 61, minHeight: 32, borderRadius: 12, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  radarAreaActionText: { color: C.navy, fontSize: 8, fontWeight: '900' },

  routeFillCard: { borderRadius: 23, backgroundColor: '#12362C', borderWidth: 1, borderColor: '#275044', padding: 14, marginBottom: 18 },
  routeFillHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  routeFillIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#1D493D', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  routeFillEyebrow: { color: C.orange, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  routeFillTitle: { color: C.white, fontSize: 16, fontWeight: '900', marginTop: 2 },
  routeFillText: { color: '#91A198', fontSize: 9, lineHeight: 14, marginBottom: 10 },
  routeFillRow: { minHeight: 55, borderTopWidth: 1, borderTopColor: '#285044', flexDirection: 'row', alignItems: 'center' },
  routeFillTime: { width: 48 },
  routeFillTimeText: { color: C.lime, fontSize: 10, fontWeight: '900' },
  routeFillJob: { color: C.white, fontSize: 10, fontWeight: '800' },
  routeFillMeta: { color: '#8FA299', fontSize: 8, marginTop: 2 },
  routeFillPay: { color: C.white, fontSize: 14, fontWeight: '900' },
  routeFillButton: { minHeight: 45, borderRadius: 14, backgroundColor: C.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10 },
  routeFillButtonText: { color: C.navy, fontSize: 10, fontWeight: '900' },

  streetRunCard: { borderRadius: 20, backgroundColor: '#FFF3EA', borderWidth: 1, borderColor: '#F0D5C5', padding: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 17 },
  streetRunCardActive: { backgroundColor: C.lime, borderColor: C.lime },
  streetRunIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.58)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  streetRunTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  streetRunEyebrow: { color: C.orange, fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginRight: 7 },
  streetRunSave: { borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.65)', paddingHorizontal: 6, paddingVertical: 3 },
  streetRunSaveText: { color: C.green, fontSize: 7, fontWeight: '900' },
  streetRunTitle: { color: C.text, fontSize: 13, fontWeight: '900' },
  streetRunText: { color: '#696B64', fontSize: 9, lineHeight: 13, marginTop: 3, paddingRight: 5 },
  streetRunCheck: { width: 25, height: 25, borderRadius: 13, borderWidth: 1.5, borderColor: '#B7B6AB', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  streetRunCheckActive: { backgroundColor: C.white, borderColor: C.white },

  jobReviewCard: { borderRadius: 22, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: C.line, padding: 15, marginTop: 14 },
  reviewHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  reviewIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#F5EDD8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  reviewEyebrow: { color: C.green, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  reviewTitle: { color: C.text, fontSize: 16, fontWeight: '900', marginTop: 2 },
  reviewText: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 11 },
  reviewStars: { flexDirection: 'row', marginTop: 10, marginBottom: 10 },
  reviewStarButton: { paddingRight: 7, paddingVertical: 3 },
  reviewStar: { fontSize: 31, color: '#D8D5CB' },
  reviewStarActive: { color: C.gold },
  reviewInput: { minHeight: 78, borderRadius: 15, backgroundColor: C.pale, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 11, textAlignVertical: 'top' },
  reviewSubmit: { minHeight: 47, borderRadius: 15, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  reviewSubmitText: { color: C.navy, fontSize: 11, fontWeight: '900' },
  reviewSubmittedRow: { marginTop: 12, borderRadius: 15, backgroundColor: '#F2F5EA', padding: 12 },
  reviewSubmittedStars: { color: C.gold, fontSize: 20, letterSpacing: 2 },
  reviewSubmittedText: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 5 },

  incomingLiveWrap: { gap: 9 },
  incomingLiveCard: { borderRadius: 21, backgroundColor: C.white, borderWidth: 1, borderColor: '#D8D5C9', padding: 14 },
  incomingLiveTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  incomingLivePulse: { width: 17, height: 17, borderRadius: 9, backgroundColor: '#DFF2E7', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  incomingLivePulseDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  incomingLiveUrgency: { color: C.green, fontSize: 8, fontWeight: '900', letterSpacing: 1.1, flex: 1 },
  incomingLiveDistance: { color: C.muted, fontSize: 9, fontWeight: '800' },
  incomingLiveTrade: { color: C.text, fontFamily: DISPLAY_FONT, fontSize: 17, fontWeight: '900' },
  incomingLiveIssue: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  incomingLiveFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  incomingLiveEta: { flex: 1, color: C.text, fontSize: 9, fontWeight: '800' },
  incomingLiveButton: { minHeight: 34, borderRadius: 12, backgroundColor: C.lime, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  incomingLiveButtonText: { color: C.navy, fontSize: 8, fontWeight: '900' },

  marketDataBanner: { minHeight: 34, borderRadius: 12, backgroundColor: '#F1EEE5', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, marginTop: 7 },
  marketDataBannerLive: { backgroundColor: '#E8F3E8' },
  marketDataDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  marketDataBannerText: { color: C.muted, fontSize: 8.5, fontWeight: '700', flex: 1 },

  tradeEditCard: { borderRadius: 23, backgroundColor: '#12362C', borderWidth: 1, borderColor: '#275044', padding: 14, marginBottom: 12 },
  tradeEditHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  tradeEditIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#1D493D', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  tradeEditTitle: { color: C.white, fontSize: 15, fontWeight: '900' },
  tradeEditSub: { color: '#91A198', fontSize: 9, lineHeight: 13, marginTop: 2 },
  tradeEditLabel: { color: '#A8B6AE', fontSize: 8, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase', marginTop: 10, marginBottom: 6 },
  tradeEditInput: { minHeight: 49, borderRadius: 14, backgroundColor: '#0C2921', borderWidth: 1, borderColor: '#2A4D42', color: C.white, paddingHorizontal: 12, fontSize: 11 },
  tradeEditBio: { minHeight: 92, paddingTop: 11, paddingBottom: 11, textAlignVertical: 'top' },
  tradeEditTradeRow: { paddingRight: 10 },
  tradeEditChip: { minHeight: 37, borderRadius: 14, backgroundColor: '#0C2921', borderWidth: 1, borderColor: '#2A4D42', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  tradeEditChipActive: { backgroundColor: C.lime, borderColor: C.lime },
  tradeEditChipText: { color: '#A8B6AE', fontSize: 9, fontWeight: '800' },
  tradeEditChipTextActive: { color: C.navy },
  tradeEditSave: { minHeight: 48, borderRadius: 15, backgroundColor: C.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  tradeEditSaveText: { color: C.navy, fontSize: 10, fontWeight: '900' },

  marketTradeActiveCard: { borderRadius: 22, backgroundColor: '#EAF1E4', borderWidth: 1, borderColor: '#CDD9C8', padding: 14, marginBottom: 10 },
  marketTradeOfferCard: { borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, padding: 14, marginBottom: 10 },
  marketTradeMode: { color: C.orange, fontSize: 8, fontWeight: '900', letterSpacing: 1.15, marginBottom: 2 },
  marketTradeTiming: { color: C.muted, fontSize: 9, fontWeight: '700', marginTop: 5 },
  marketTradePrice: { color: C.green, fontSize: 16, fontWeight: '900' },
  marketTradeOfferIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#FFF0E8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  marketTradePayPill: { minWidth: 68, borderRadius: 13, backgroundColor: '#E5F0DB', paddingHorizontal: 9, paddingVertical: 6, alignItems: 'center' },
  marketTradePay: { color: C.navy, fontSize: 14, fontWeight: '900' },
  marketTradePaySmall: { color: C.muted, fontSize: 7, fontWeight: '700', marginTop: 1 },
  marketTradeAccept: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' },
  marketTradeAcceptText: { color: C.navy, fontSize: 11, fontWeight: '900' },
  tradeEmptyCompact: { borderRadius: 20, backgroundColor: '#F1EFE8', padding: 18, alignItems: 'center', marginBottom: 15, gap: 6 },

});

