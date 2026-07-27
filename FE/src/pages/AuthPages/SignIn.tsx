import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Sign in · CyberPOS"
        description="Sign in to the CyberPOS point of sale terminal."
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
