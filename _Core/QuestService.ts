import { Quest } from "../_Data/Quest";
import { Location } from "../_Data/Location";
import { Passage } from "../_Data/Passage";
import { LocationType } from "../_Data/_Enums/LocationType";

export class QuestService {

    static findLocationWith(quest: Quest, id: number): Location | null {
        return quest.locations.find(location => location.id === id) ?? null;
    }

    static findPassageWith(quest: Quest, id: number): Passage | null {
        return quest.passages.find(passage => passage.id === id) ?? null;
    }

   static findStartLocation(quest: Quest): Location | null {
    return quest.locations.find(location =>
        location.locationType === LocationType.Start
    ) ?? null;
}

    static findAllPassagesFromLocation(quest: Quest, locationId: number): Passage[] {
        return quest.passages.filter(passage => passage.from === locationId);
    }
}