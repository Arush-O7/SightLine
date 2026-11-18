// Free-licence photos from Wikimedia Commons, credited on the Credits page.

export interface Photo {
  /** 1280px-wide image on upload.wikimedia.org */
  src: string;
  author: string;
  license: string;
  /** the file's page on Wikimedia Commons */
  page: string;
  /** what the photo actually shows, when it isn't the place it illustrates */
  note?: string;
}

const commons = (path: string, file: string, author: string, license: string, note?: string): Photo => ({
  src: `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/${file}/1280px-${file}`,
  author,
  license,
  page: `https://commons.wikimedia.org/wiki/File:${decodeURIComponent(file)}`,
  note,
});

/** The same photo at a smaller standard width (Wikimedia serves fixed steps such as 500, 960 and 1280). */
export const sized = (photo: Photo, width: 500 | 960 | 1280) => photo.src.replace('/1280px-', `/${width}px-`);

export const PHOTOS = {
  selectCitywalk: commons('6/60', 'Select_Citywalk%2C_Saket%2C_New_Delhi..jpg', 'KuwarOnline', 'CC BY-SA 3.0'),
  dlfAvenue: commons('b/b2', 'DLF_Avenue_Mall_Interior_Of_Saket_-_New_Delhi_20221218_164432.jpg', 'Biswarup Ganguly', 'CC BY 3.0'),
  pvrPlaza: commons('f/f5', 'PVR_Plaza_No_poster_for_Padmaavati.jpg', 'Pulakit Singh', 'CC BY-SA 4.0'),
  nehruPlace: commons('9/9b', 'Delhi-Nehru-Place-Skyline.jpeg', 'Deepanshu Madaan', 'CC0', 'The Nehru Place skyline'),
  pacificMall: commons('e/e8', 'Pacific_Mall_Tagore_Garden.jpg', 'Pacificgroup21', 'CC BY-SA 4.0'),
  vegasMall: commons('3/35', 'Vegas_Mall%2C_Dwarka.jpg', 'ArmouredCyborg', 'CC BY-SA 4.0'),
  reclinerHall: commons('6/67', 'Luxury_Movie_Theater_Seats.jpg', 'Author0612', 'CC BY-SA 4.0', 'Representative photo of a recliner auditorium, not this cinema'),
  singleScreen: commons('d/da', 'Elgin_Talkies_-_inside.jpg', 'Paul Keller', 'CC BY 2.0', 'Representative photo of a single-screen hall (Elgin Talkies, Bengaluru), not this cinema'),
  comedyStage: commons('c/ce', 'Stand-up_comedy_-_Stage.jpg', 'Carlos Delgado', 'CC BY-SA 3.0'),
  concertCrowd: commons('1/1a', 'A_large_crowd_enjoys_a_music_concert_illuminated_by_colorful_lights_and_a_stunning_stage_display.jpg', 'Shixart1985', 'CC BY 2.0'),
  concertHall: commons('f/f7', 'Helsinki_Music_Centre_Concert_Hall_1.jpg', 'Saruwine', 'CC BY 4.0'),
  saxophone: commons('7/7c', 'Bombay_Jazz_-_A_play_by_StageSmith_Productions.JPG', 'Drashmi', 'CC BY-SA 4.0'),
  stadiumNight: commons('a/a0', 'Arun_Jaitley_stadium_2023.jpg', 'Ciell', 'CC BY-SA 4.0'),
  stadiumDay: commons('8/86', 'Arun_Jaitley_Stadium_during_World_Cup_2023.jpg', 'Paramgoel', 'CC BY-SA 4.0'),
  stageSet: commons('0/01', 'Empty_set_of_the_Ride_Musical.jpg', 'Alex Chan', 'CC BY 2.0'),
} satisfies Record<string, Photo>;
