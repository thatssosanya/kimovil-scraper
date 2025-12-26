import React from "react";
import { Dialog, DialogTrigger } from "../components/ui/Dialog";
import { DialogContent } from "@radix-ui/react-dialog";
import { ComboBox } from "../components/ui/ComboBox";

const test = () => {
  return (
    <Dialog>
      <DialogTrigger>
        <div>test</div>
      </DialogTrigger>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
          void e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          e.preventDefault();
        }}
        className=""
      >
        {/* eslint-disable-next-line @typescript-eslint/no-empty-function */}
        <ComboBox placeholder="" onChange={() => null} setValue={() => {}} />
      </DialogContent>
    </Dialog>
  );
};

export default test;
