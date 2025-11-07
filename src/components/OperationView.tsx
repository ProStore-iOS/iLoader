import { OperationState } from "./operations";
import "./OperationView.css";
import { Modal } from "./Modal";
import {
  FaCircleExclamation,
  FaCircleCheck,
  FaCircleMinus,
} from "react-icons/fa6";

export default ({
  operationState,
  closeMenu,
}: {
  operationState: OperationState;
  closeMenu: () => void;
}) => {
  const operation = operationState.current;
  const opFailed = operationState.failed.length > 0;
  const done =
    (opFailed &&
      operationState.started.length ==
        operationState.completed.length + operationState.failed.length) ||
    operationState.completed.length == operation.steps.length;

  return (
    <Modal
      isOpen={true}
      close={() => {
        if (done) closeMenu();
      }}
      hideClose={!done}
      sizeFit
    >
      <div className="operation-header">
        <h3>
          {done && !opFailed && operation.successTitle
            ? operation?.successTitle
            : operation?.title}
        </h3>
        <p>
          {done
            ? opFailed
              ? "Operation failed"
              : "Operation completed"
            : "Please wait..."}
        </p>
      </div>
      <div className="operation-content-container">
        <div className="operation-content">
          {operation.steps.map((step) => {
            let failed = operationState.failed.find((f) => f.stepId == step.id);
            let completed = operationState.completed.includes(step.id);
            let started = operationState.started.includes(step.id);
            let notStarted = !failed && !completed && !started;
            return (
              <div className="operation-step" key={step.id}>
                <div className="operation-step-icon">
                  {failed && (
                    <FaCircleExclamation className="operation-error" />
                  )}
                  {!failed && completed && (
                    <FaCircleCheck className="operation-check" />
                  )}
                  {!failed && !completed && started && (
                    <div className="loading-icon" />
                  )}
                  {notStarted && !opFailed && <div className="waiting-icon" />}
                  {notStarted && opFailed && (
                    <FaCircleMinus className="operation-skipped" />
                  )}
                </div>

                <div className="operation-step-internal">
                  <p>{step.title}</p>
                  {failed && (
                    <pre className="operation-extra-details">
                      {failed.extraDetails}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {done && !opFailed && operation.successMessage && (
        <p className="operation-success-message">{operation.successMessage}</p>
      )}
      {done && !(!opFailed && operation.successMessage) && <p></p>}
      {done && <button onClick={closeMenu}>Dismiss</button>}
    </Modal>
  );
};
