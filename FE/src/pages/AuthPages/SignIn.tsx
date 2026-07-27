import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Sign in · MKB POS"
        description="Sign in to the MKB point of sale terminal."
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
