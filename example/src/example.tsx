import {ReactElement} from "react";

export interface ExampleProps {
    name: string;
}

export function Example({name}: ExampleProps): ReactElement {
    return (
        <p>Hello, {name}!</p>
    )
}
