import React from 'react';
import { ArthivaLogo, ArthivaLogoProps } from './ArthivaLogo';

export type NaomiLogoProps = ArthivaLogoProps;

export function NaomiLogo(props: NaomiLogoProps) {
  return <ArthivaLogo {...props} />;
}

export { ArthivaLogo };
export default ArthivaLogo;
