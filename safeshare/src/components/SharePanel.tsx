import ReceiverBox from "./ReceiverBox";
import SenderBox from "./SenderBox";

export default function SharePanel(){
    return (
        <div className="flex justify-center gap-5 mt-18 ml-18">
            <SenderBox />
            <ReceiverBox />
        </div>
    )
}