"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
export function Modal({open,onOpenChange,title,children,locked=false}:{open:boolean;onOpenChange:(open:boolean)=>void;title:string;children:React.ReactNode;locked?:boolean}) {
  return <Dialog.Root open={open} onOpenChange={value=>{if(!locked)onOpenChange(value);}}>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[20px]"/>
      <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-32px)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-card border border-border-soft bg-background p-8 shadow-float">
        <Dialog.Title className="mb-6 text-2xl font-medium">{title}</Dialog.Title>
        {children}
        {!locked&&<Dialog.Close asChild><Button variant="outline" className="mt-6">Tutup</Button></Dialog.Close>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
