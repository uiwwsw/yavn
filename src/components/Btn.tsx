import { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

const Btn = ({ children, className = '', ...props }: ButtonProps) => {
  const handleOver = (e: MouseEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;
    if (target) target.focus();
  };

  return (
    <button
      {...props}
      onMouseOver={handleOver}
      className={`rounded-sm border bg-black p-3 py-1 hover:animate-pulse focus:animate-pulse ${className}`}
      style={{ animationDuration: '500ms' }}
    >
      {children}
    </button>
  );
};

export default Btn;
