import { SignUp } from "@clerk/nextjs";

const SignUpPage = () => (
  <div className="flex h-full w-full items-center justify-center">
    <SignUp
      appearance={{
        layout: {
          logoPlacement: "inside",
        },
      }}
      path="/sign-up"
      routing="path"
      signInUrl="/sign-in"
    />
  </div>
);

export default SignUpPage;
