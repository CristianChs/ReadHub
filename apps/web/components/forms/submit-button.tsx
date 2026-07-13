import { Button, type ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface SubmitButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
}

// Botón de envío con estado de carga integrado (spinner + deshabilitado).
export function SubmitButton({
  loading = false,
  loadingText,
  children,
  disabled,
  type = "submit",
  ...props
}: SubmitButtonProps) {
  return (
    <Button type={type} disabled={loading || disabled} {...props}>
      {loading && <Spinner />}
      {loading ? (loadingText ?? children) : children}
    </Button>
  );
}
