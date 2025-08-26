import React from "react";

export default function WalcordPeopleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="7" cy="7" r="3" stroke="#1F48AF" strokeWidth="1.2" />
      <circle cx="13" cy="8" r="3" stroke="#1F48AF" strokeWidth="1.2" fill="white" />
      <path
        d="M4 15C4 12.7909 5.79086 11 8 11H8.5C10.7091 11 12.5 12.7909 12.5 15V16H4V15Z"
        stroke="#1F48AF"
        strokeWidth="1.2"
      />
      <path
        d="M11 15C11 13.3431 12.3431 12 14 12H14.5C16.1569 12 17.5 13.3431 17.5 15V16H11V15Z"
        stroke="#1F48AF"
        strokeWidth="1.2"
      />
    </svg>
  );
}
