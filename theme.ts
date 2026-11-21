import {Platform} from 'react-native';
// Shared visual language for the pro and customer sides of Trade App.
// Keep all colours and reusable shape tokens here.
export const theme = {
  colors: {
    proBackground: '#F3F5F4',
    customerBackground: '#F5F2EC',
    customerTabBar: '#FFFCF7',
    ink: '#0C1F24',
    darkTeal: '#0F2A30',
    tealTint: '#E8F0EF',
    teal: '#245758',
    tealMid: '#2F6A6B',
    coral: '#E0704C',
    coralDark: '#C4502B',
    coralTint: '#FCE8E0',
    coralText: '#9A3F20',
    muted: '#52646A',
    success: '#1F9D63',
    white: '#FFFFFF',
    line: '#E4EAE8',
    soft: '#EEF2F1',
  },
  font: {
    // Restore the original native system typography that preceded the
    // 21 November editorial/monospaced overhaul. Preserve existing sizes,
    // weights, spacing and accessibility scaling; no custom font assets.
    editorial: Platform.OS==='ios'?'System':'sans-serif',
    heading: Platform.OS==='ios'?'System':'sans-serif',
    body: Platform.OS==='ios'?'System':'sans-serif',
    numeric: Platform.OS==='ios'?'System':'sans-serif',
  },
  type: {
    titleSize: 34,
    sectionSize: 20,
    bodySize: 15,
    titleWeight: '800' as const,
    sectionWeight: '800' as const,
  },
  shape: {
    cardRadius: 28,
    smallCardRadius: 24,
    buttonRadius: 28,
    buttonHeight: 56,
    tabHeight: 84,
  },
  shadow: {
    shadowColor: '#0C1F24',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 24,
    elevation: 3,
  },
} as const;
