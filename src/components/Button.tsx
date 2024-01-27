import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps  {
  autoFocus?: ButtonHTMLAttributes<HTMLButtonElement>['autoFocus']
  children?: ReactNode;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
}
const Button = ({ children,...props }: ButtonProps) => {
  return (
    <button  {...props} className="rounded-sm border p-3 py-1 hover:animate-pulse focus:animate-pulse" style={{animationDuration:'500ms'}} >
      {children}
    </button>
  );
};

export default Button;
