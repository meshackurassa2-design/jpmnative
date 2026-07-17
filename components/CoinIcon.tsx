import React from 'react';
import Svg, { Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

export function CoinIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="goldGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FDE047" stopOpacity="1" />
          <Stop offset="0.5" stopColor="#F59E0B" stopOpacity="1" />
          <Stop offset="1" stopColor="#B45309" stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id="innerGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FEF08A" stopOpacity="1" />
          <Stop offset="1" stopColor="#D97706" stopOpacity="1" />
        </LinearGradient>

      </Defs>

      {/* Shadow layer */}
      <Circle cx="50" cy="53" r="48" fill="#000000" opacity="0.3" />
      {/* Outer Rim */}
      <Circle cx="50" cy="50" r="48" fill="url(#goldGradient)" />
      
      {/* Inner Indentation */}
      <Circle cx="50" cy="50" r="38" fill="url(#innerGradient)" stroke="#B45309" strokeWidth="2" />
      
      {/* Inner Ridge */}
      <Circle cx="50" cy="50" r="32" fill="none" stroke="#FEF08A" strokeWidth="1" strokeDasharray="4,4" />

      {/* Text/Symbol in the middle */}
      <SvgText
        x="50"
        y="68"
        fontSize="44"
        fontWeight="bold"
        fill="#78350F"
        textAnchor="middle"
        fontFamily="sans-serif"
      >
        D
      </SvgText>
      
      <SvgText
        x="50"
        y="67"
        fontSize="44"
        fontWeight="bold"
        fill="#FEF08A"
        textAnchor="middle"
        fontFamily="sans-serif"
      >
        D
      </SvgText>
    </Svg>
  );
}
