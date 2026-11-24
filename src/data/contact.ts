/** What a message to the SightLine team can be about. The server and the Contact page share this list. */
export const MESSAGE_TOPICS = [
  { id: 'booking', label: 'Booking or ticket problem' },
  { id: 'feedback', label: 'Feedback or idea' },
  { id: 'partnership', label: 'Cinema partnership' },
  { id: 'other', label: 'Something else' },
] as const;

export type MessageTopic = (typeof MESSAGE_TOPICS)[number]['id'];

export const isMessageTopic = (v: unknown): v is MessageTopic => MESSAGE_TOPICS.some((t) => t.id === v);

export const topicLabel = (id: string) => MESSAGE_TOPICS.find((t) => t.id === id)?.label ?? id;

export const MESSAGE_STATUSES = ['new', 'replied', 'closed'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/** A booking reference as tickets show it, such as SL-AB12CD. */
export const BOOKING_REF = /^SL-[A-Z0-9]{6}$/;

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
export const RATING_COMMENT_MAX = 500;

/** Words for each point of the 1 to 5 seat-choice rating. */
export const RATING_WORDS = ['Very hard', 'Hard', 'Okay', 'Easy', 'Very easy'] as const;
