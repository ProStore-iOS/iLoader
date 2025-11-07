export type Operation = {
  id: string;
  title: string;
  successMessage?: string;
  successTitle?: string;
  steps: OperationStep[];
};

export type OperationStep = {
  id: string;
  title: string;
};

export type OperationState = {
  current: Operation;
  completed: string[];
  started: string[];
  failed: {
    stepId: string;
    extraDetails: string;
  }[];
};

type OperationInfoUpdate = {
  updateType: "started" | "finished";
  stepId: string;
};

type OperationFailedUpdate = {
  updateType: "failed";
  stepId: string;
  extraDetails: string;
};

export type OperationUpdate = OperationInfoUpdate | OperationFailedUpdate;

export const installSideStoreOperation: Operation = {
  id: "install_sidestore",
  title: "Installing SideStore",
  successTitle: "SideStore Installed!",
  successMessage:
    "Open SideStore and refresh it to complete the installation! SideStore will expire early if you skip this step.",
  steps: [
    {
      id: "download",
      title: "Download SideStore",
    },
    {
      id: "install",
      title: "Sign & Install SideStore",
    },
    {
      id: "pairing",
      title: "Place Pairing File",
    },
  ],
};

export const sideloadOperation = {
  id: "sideload",
  title: "Installing App",
  steps: [
    {
      id: "install",
      title: "Sign & Install App",
    },
  ],
};
