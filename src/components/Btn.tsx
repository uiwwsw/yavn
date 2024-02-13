import { ButtonHTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react';

interface ButtonProps {
  autoFocus?: ButtonHTMLAttributes<HTMLButtonElement>['autoFocus'];
  children?: ReactNode;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
}
const Btn = ({ children, ...props }: ButtonProps) => {
  const handleOver = (e: MouseEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;
    if (target) target.focus();
  };

  return (
    <button
      {...props}
      onMouseOver={handleOver}
      className="rounded-sm border bg-black p-3 py-1 hover:animate-pulse focus:animate-pulse"
      style={{ animationDuration: '500ms' }}
    >
      {children}
    </button>
  );
};

export default Btn;
