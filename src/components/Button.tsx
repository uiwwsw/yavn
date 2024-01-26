import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps {
  children?: ReactNode;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
}
const Button = ({ children, onClick }: ButtonProps) => {
  const handleClick = async () => {};
  return (
    <button autoFocus className="rounded-sm border p-3 py-1 hover:animate-pulse focus:animate-pulse" onClick={onClick}>
      {children}
    </button>
  );
};

export default Button;
