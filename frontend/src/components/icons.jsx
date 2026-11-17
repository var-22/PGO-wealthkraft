const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
const make = (children) => (props) => <svg {...base} {...props}>{children}</svg>;

export const HomeIcon = make(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></>);
export const FundsIcon = make(<><rect x="3" y="4" width="18" height="5" rx="1.5" /><rect x="3" y="11" width="18" height="5" rx="1.5" /><path d="M5 20h14" /></>);
export const InsightsIcon = make(<><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>);
export const ProfileIcon = make(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.2-4 4.2-6 8-6s6.800 2 8 6" /></>);
export const BackIcon = make(<path d="M15 5l-7 7 7 7" />);
export const ChevronIcon = make(<path d="M9 5l7 7-7 7" />);
export const SearchIcon = make(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.800-3.800" /></>);
export const RefreshIcon = make(<><path d="M20 11a8 8 0 0 0-14.500-4.500L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.500 4.500L20 16" /><path d="M20 20v-4h-4" /></>);
export const UploadIcon = make(<><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>);
export const SignOutIcon = make(<><path d="M10 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" /><path d="M15 8l4 4-4 4" /><path d="M19 12H9" /></>);
export const InfoIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.500v.500" /></>);
export const EyeIcon = make(<><path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z" /><circle cx="12" cy="12" r="3" /></>);
export const EyeOffIcon = make(<><path d="M4 4l16 16" /><path d="M9.900 5.800A9.300 9.300 0 0 1 12 5.500c6 0 9.500 6.500 9.500 6.500a17 17 0 0 1-2.700 3.500" /><path d="M6.300 7.600A16.500 16.500 0 0 0 2.500 12S6 18.500 12 18.500a9 9 0 0 0 3.900-.900" /><path d="M9.900 9.900a3 3 0 0 0 4.200 4.200" /></>);
export const DownloadIcon = make(<><path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" /></>);
export const ListIcon = make(<><path d="M8 6h12" /><path d="M8 12h12" /><path d="M8 18h12" /><path d="M4 6h.500" /><path d="M4 12h.500" /><path d="M4 18h.500" /></>);
export const CalendarIcon = make(<><rect x="3.500" y="5" width="17" height="15.500" rx="2.500" /><path d="M3.500 10h17" /><path d="M8 3v4" /><path d="M16 3v4" /></>);
export const CloseIcon = make(<><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>);
export const NewsIcon = make(<><path d="M5 5h11v13.500a1.500 1.500 0 0 0 3 0V9h-3" /><path d="M5 5v13.500A1.500 1.500 0 0 0 6.500 20h11" /><path d="M8 9h5" /><path d="M8 12.500h5" /><path d="M8 16h3" /></>);
export const BellIcon =make(<><path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 2h-15z" /><path d="M10 21a2.200 2.200 0 0 0 4 0" /></>);
export const WalletIcon = make(<><path d="M4 7.500A2.500 2.500 0 0 1 6.500 5H17v3" /><rect x="4" y="8" width="16.500" height="11" rx="2.500" /><path d="M16.500 13.500h.500" /></>);
export const ShieldIcon = make(<><path d="M12 3l7.500 2.800v5.700c0 4.300-3 7.800-7.500 9.500-4.500-1.700-7.500-5.200-7.500-9.500V5.800z" /><path d="M8.800 12l2.300 2.300 4.200-4.400" /></>);
export const ScaleIcon = make(<><path d="M12 4v16" /><path d="M7.500 20h9" /><path d="M5 7h14" /><path d="M5 7l-2.500 6a2.700 2.700 0 0 0 5 0z" /><path d="M19 7l-2.500 6a2.700 2.700 0 0 0 5 0z" /></>);
export const TrendIcon = make(<><path d="M4 20V5" /><path d="M4 20h16" /><path d="M7.500 15.500l3.500-4 3 2.500 5-6" /><path d="M15.500 8H19v3.500" /></>);
export const ClockIcon = make(<><circle cx="12" cy="12" r="8.500" /><path d="M12 7.500V12l3 2" /></>);
export const ArrowIcon = make(<><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>);
export const StarIcon = (props) => <svg {...base} fill="currentColor" stroke="none" {...props}><path d="M12 2.800l2.800 5.900 6.400.800-4.700 4.500 1.200 6.400L12 17.300l-5.700 3.100 1.200-6.400L2.800 9.500l6.400-.800z" /></svg>;

// Status marks: each state has its own shape as well as its own color.
export const StatusIcon = ({ status, size = 14 }) => {
  const p = { ...base, width: size, height: size, strokeWidth: 2.600 };
  if (status === "ON TRACK") return <svg {...p}><path d="M5 12.500l4.500 4.500L19 7.500" /></svg>;
  if (status === "WATCH") return <svg {...p}><circle cx="12" cy="12" r="8.500" /><path d="M12 7.500V12l3 2" /></svg>;
  if (status === "OFF TRACK") return <svg {...p}><path d="M12 4.500v9" /><path d="M12 18.500v.500" /></svg>;
  return <svg {...p}><path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14z" /><path d="M5 19l7-7" /></svg>;
};
